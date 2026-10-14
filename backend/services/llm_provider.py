"""Unified LLM Provider & BYOK Inference Orchestrator for Nexus IDE.

Supports:
1. Local Ollama models (qwen2.5-coder, deepseek-coder, llama3.2, etc.)
2. OpenAI BYOK (gpt-4o, o3-mini, gpt-4o-mini)
3. Anthropic BYOK (claude-3-5-sonnet, claude-3-7-sonnet)
4. OpenRouter BYOK (deepseek/deepseek-r1, meta-llama/llama-3.3-70b-instruct)
5. Mock zero-key deterministic fallback
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple
import urllib.request
import urllib.error

logger = logging.getLogger("nexus.services.llm_provider")


class BaseLLMProvider(ABC):
    """Abstract base class for all model inference providers."""

    @abstractmethod
    async def stream_chat(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str,
        api_key: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream generated tokens from model provider."""
        yield ""

    @abstractmethod
    def verify_key(self, api_key: str, model: Optional[str] = None) -> Tuple[bool, str]:
        """Verify validity of an API key or connectivity to local daemon."""
        return True, "Valid"


# -------------------------------------------------------------------------- #
# 1. Local Ollama Provider
# -------------------------------------------------------------------------- #

class OllamaProvider(BaseLLMProvider):
    """Inference provider for local Ollama instances."""

    def __init__(self, base_url: Optional[str] = None) -> None:
        self.base_url = (base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")).rstrip("/")

    def is_daemon_running(self) -> Tuple[bool, List[str]]:
        """Check if Ollama is running and fetch list of downloaded models."""
        url = f"{self.base_url}/api/tags"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NexusIDE"})
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    models = [m.get("name", "") for m in data.get("models", []) if m.get("name")]
                    return True, models
        except Exception:
            pass
        return False, []

    def verify_key(self, api_key: str = "", model: Optional[str] = None) -> Tuple[bool, str]:
        running, models = self.is_daemon_running()
        if not running:
            return False, f"Ollama daemon is not reachable at {self.base_url}."
        if model and model not in models:
            return True, f"Ollama is running ({len(models)} models found), but '{model}' may need to be pulled."
        return True, f"Ollama is running with {len(models)} local models."

    async def stream_chat(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str,
        api_key: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": model or "qwen2.5-coder",
            "system": system_prompt,
            "prompt": user_prompt,
            "stream": True,
        }
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        def _fetch():
            return urllib.request.urlopen(req, timeout=60)

        try:
            resp = await asyncio.to_thread(_fetch)
        except Exception as exc:
            logger.warning("Ollama connection failed: %s. Using fallback.", exc)
            yield f"[Ollama Error: Could not connect to {self.base_url} - {exc}]"
            return

        loop = asyncio.get_running_loop()
        while True:
            line = await loop.run_in_executor(None, resp.readline)
            if not line:
                break
            line_str = line.decode("utf-8").strip()
            if not line_str:
                continue
            try:
                chunk_obj = json.loads(line_str)
                token = chunk_obj.get("response", "")
                if token:
                    yield token
                if chunk_obj.get("done", False):
                    break
            except Exception:
                continue


# -------------------------------------------------------------------------- #
# 2. OpenAI Provider (BYOK)
# -------------------------------------------------------------------------- #

class OpenAIProvider(BaseLLMProvider):
    """Inference provider for OpenAI APIs."""

    def __init__(self, default_key: Optional[str] = None) -> None:
        self.default_key = default_key or os.getenv("OPENAI_API_KEY", "").strip()

    def verify_key(self, api_key: str, model: Optional[str] = None) -> Tuple[bool, str]:
        key = api_key.strip() or self.default_key
        if not key:
            return False, "OpenAI API key is missing."
        req = urllib.request.Request(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {key}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    return True, "OpenAI API key is valid."
        except urllib.error.HTTPError as err:
            return False, f"OpenAI authentication failed: HTTP {err.code}."
        except Exception as exc:
            return False, f"OpenAI verification error: {exc}."
        return False, "OpenAI verification failed."

    async def stream_chat(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str,
        api_key: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        key = (api_key or "").strip() or self.default_key
        if not key:
            yield "[OpenAI Error: No API key provided.]"
            return

        payload = {
            "model": model or "gpt-4o",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": True,
        }
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=data_bytes,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            resp = await asyncio.to_thread(urllib.request.urlopen, req, timeout=60)
        except Exception as exc:
            logger.warning("OpenAI request error: %s", exc)
            yield f"[OpenAI Error: {exc}]"
            return

        loop = asyncio.get_running_loop()
        while True:
            line = await loop.run_in_executor(None, resp.readline)
            if not line:
                break
            line_str = line.decode("utf-8").strip()
            if not line_str or line_str.startswith(":"):
                continue
            if line_str.startswith("data: "):
                data_content = line_str[6:].strip()
                if data_content == "[DONE]":
                    break
                try:
                    parsed = json.loads(data_content)
                    choices = parsed.get("choices", [])
                    if choices:
                        delta = choices[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                except Exception:
                    continue


# -------------------------------------------------------------------------- #
# 3. Anthropic Provider (BYOK)
# -------------------------------------------------------------------------- #

class AnthropicProvider(BaseLLMProvider):
    """Inference provider for Anthropic Claude APIs."""

    def __init__(self, default_key: Optional[str] = None) -> None:
        self.default_key = default_key or os.getenv("ANTHROPIC_API_KEY", "").strip()

    def verify_key(self, api_key: str, model: Optional[str] = None) -> Tuple[bool, str]:
        key = api_key.strip() or self.default_key
        if not key:
            return False, "Anthropic API key is missing."
        payload = {
            "model": model or "claude-3-5-sonnet-20241022",
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "ping"}],
        }
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status in (200, 201):
                    return True, "Anthropic API key is valid."
        except urllib.error.HTTPError as err:
            if err.code == 401:
                return False, "Anthropic API key is invalid (401 Unauthorized)."
            return True, f"Anthropic responded with code {err.code}."
        except Exception as exc:
            return False, f"Anthropic verification error: {exc}"
        return False, "Anthropic verification failed."

    async def stream_chat(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str,
        api_key: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        key = (api_key or "").strip() or self.default_key
        if not key:
            yield "[Anthropic Error: No API key provided.]"
            return

        target_model = model or "claude-3-5-sonnet-20241022"
        # Map friendly name
        if "3-7" in target_model or "3.7" in target_model:
            target_model = "claude-3-7-sonnet-20250219"
        elif "3-5" in target_model or "3.5" in target_model:
            target_model = "claude-3-5-sonnet-20241022"

        payload = {
            "model": target_model,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            "stream": True,
        }
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=data_bytes,
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            resp = await asyncio.to_thread(urllib.request.urlopen, req, timeout=60)
        except Exception as exc:
            logger.warning("Anthropic request error: %s", exc)
            yield f"[Anthropic Error: {exc}]"
            return

        loop = asyncio.get_running_loop()
        while True:
            line = await loop.run_in_executor(None, resp.readline)
            if not line:
                break
            line_str = line.decode("utf-8").strip()
            if not line_str or line_str.startswith(":"):
                continue
            if line_str.startswith("data: "):
                data_content = line_str[6:].strip()
                try:
                    parsed = json.loads(data_content)
                    event_type = parsed.get("type", "")
                    if event_type == "content_block_delta":
                        delta = parsed.get("delta", {})
                        text = delta.get("text", "")
                        if text:
                            yield text
                    elif event_type == "message_stop":
                        break
                except Exception:
                    continue


# -------------------------------------------------------------------------- #
# 4. OpenRouter Provider (BYOK)
# -------------------------------------------------------------------------- #

class OpenRouterProvider(BaseLLMProvider):
    """Inference provider for OpenRouter multi-model gateway."""

    def __init__(self, default_key: Optional[str] = None) -> None:
        self.default_key = default_key or os.getenv("OPENROUTER_API_KEY", "").strip()

    def verify_key(self, api_key: str, model: Optional[str] = None) -> Tuple[bool, str]:
        key = api_key.strip() or self.default_key
        if not key:
            return False, "OpenRouter API key is missing."
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/auth/key",
            headers={"Authorization": f"Bearer {key}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    return True, "OpenRouter API key is valid."
        except urllib.error.HTTPError as err:
            return False, f"OpenRouter auth failed: HTTP {err.code}."
        except Exception as exc:
            return False, f"OpenRouter verification error: {exc}"
        return False, "OpenRouter verification failed."

    async def stream_chat(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str,
        api_key: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        key = (api_key or "").strip() or self.default_key
        if not key:
            yield "[OpenRouter Error: No API key provided.]"
            return

        payload = {
            "model": model or "deepseek/deepseek-r1",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": True,
        }
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=data_bytes,
            headers={
                "Authorization": f"Bearer {key}",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Nexus IDE",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            resp = await asyncio.to_thread(urllib.request.urlopen, req, timeout=60)
        except Exception as exc:
            logger.warning("OpenRouter request error: %s", exc)
            yield f"[OpenRouter Error: {exc}]"
            return

        loop = asyncio.get_running_loop()
        while True:
            line = await loop.run_in_executor(None, resp.readline)
            if not line:
                break
            line_str = line.decode("utf-8").strip()
            if not line_str or line_str.startswith(":"):
                continue
            if line_str.startswith("data: "):
                data_content = line_str[6:].strip()
                if data_content == "[DONE]":
                    break
                try:
                    parsed = json.loads(data_content)
                    choices = parsed.get("choices", [])
                    if choices:
                        delta = choices[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                except Exception:
                    continue


# -------------------------------------------------------------------------- #
# 5. Mock Deterministic Provider (Offline Fallback)
# -------------------------------------------------------------------------- #

class MockProvider(BaseLLMProvider):
    """High-craft deterministic fallback provider for zero-friction testing & offline demos."""

    def verify_key(self, api_key: str = "", model: Optional[str] = None) -> Tuple[bool, str]:
        return True, "Mock provider active (deterministic zero-key offline mode)."

    async def stream_chat(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str,
        api_key: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        thoughts = [
            "FalkorDB graph traversal completed in 0.8ms.",
            "Analyzing multi-hop blast radius callers in reverse dependency tree.",
            "Retrieving procedural memory rules and prior incident resolutions.",
            "Validating clock skew tolerance and fail-closed security assertions.",
            "Synthesizing non-breaking TypeScript patch for target function...",
        ]
        for t in thoughts:
            yield f"💭 {t}\n"
            await asyncio.sleep(0.04)


# -------------------------------------------------------------------------- #
# LLM Provider Factory & Model Catalog
# -------------------------------------------------------------------------- #

class LLMProviderFactory:
    """Unified factory for creating and retrieving inference providers."""

    _providers: Dict[str, BaseLLMProvider] = {}

    @classmethod
    def get_provider(cls, provider_name: str) -> BaseLLMProvider:
        normalized = (provider_name or "mock").lower().strip()
        if normalized not in cls._providers:
            if normalized == "ollama":
                cls._providers[normalized] = OllamaProvider()
            elif normalized == "openai":
                cls._providers[normalized] = OpenAIProvider()
            elif normalized == "anthropic":
                cls._providers[normalized] = AnthropicProvider()
            elif normalized == "openrouter":
                cls._providers[normalized] = OpenRouterProvider()
            else:
                cls._providers[normalized] = MockProvider()
        return cls._providers[normalized]

    @classmethod
    def get_available_models(cls) -> Dict[str, Any]:
        """Discover available local models and catalog supported cloud BYOK models."""
        ollama = cls.get_provider("ollama")
        assert isinstance(ollama, OllamaProvider)
        ollama_running, detected_models = ollama.is_daemon_running()

        catalog = {
            "ollama": {
                "active": ollama_running,
                "endpoint": ollama.base_url,
                "detected_models": detected_models,
                "recommended_models": [
                    "qwen2.5-coder",
                    "deepseek-coder",
                    "llama3.2",
                    "codellama",
                ],
            },
            "cloud_providers": [
                {
                    "provider": "openai",
                    "name": "OpenAI",
                    "models": ["gpt-4o", "o3-mini", "gpt-4o-mini"],
                    "requires_key": True,
                    "env_key_present": bool(os.getenv("OPENAI_API_KEY")),
                },
                {
                    "provider": "anthropic",
                    "name": "Anthropic",
                    "models": ["claude-3-5-sonnet", "claude-3-7-sonnet"],
                    "requires_key": True,
                    "env_key_present": bool(os.getenv("ANTHROPIC_API_KEY")),
                },
                {
                    "provider": "openrouter",
                    "name": "OpenRouter",
                    "models": ["deepseek/deepseek-r1", "meta-llama/llama-3.3-70b-instruct"],
                    "requires_key": True,
                    "env_key_present": bool(os.getenv("OPENROUTER_API_KEY")),
                },
                {
                    "provider": "mock",
                    "name": "Nexus Mock (Offline Demo)",
                    "models": ["deterministic-mock-v1"],
                    "requires_key": False,
                    "env_key_present": True,
                },
            ],
        }
        return catalog
