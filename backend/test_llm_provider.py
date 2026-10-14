"""Unit & Integration Test Suite for LLM Provider Factory and BYOK Inference.

Tests:
1. Provider factory mapping (Ollama, OpenAI, Anthropic, OpenRouter, Mock).
2. Key verification and daemon detection.
3. Streaming inference response handling.
"""

from __future__ import annotations

import asyncio
import sys
from services.llm_provider import LLMProviderFactory, BaseLLMProvider


async def run_tests() -> None:
    print("=" * 65)
    print("🧪 Running Nexus LLM Provider Test Suite")
    print("=" * 65)

    # 1. Test Model Catalog Discovery
    print("\n[Test 1] Testing model catalog discovery...")
    models = LLMProviderFactory.get_available_models()
    assert "ollama" in models, "Ollama key missing in catalog"
    assert "cloud_providers" in models, "cloud_providers missing in catalog"
    print(f"  ✔ Detected Ollama active: {models['ollama']['active']}")
    print(f"  ✔ Cloud providers available: {[p['provider'] for p in models['cloud_providers']]}")

    # 2. Test Provider Factory Retrieval
    print("\n[Test 2] Testing provider factory instances...")
    providers = ["mock", "ollama", "openai", "anthropic", "openrouter"]
    for p_name in providers:
        provider = LLMProviderFactory.get_provider(p_name)
        assert isinstance(provider, BaseLLMProvider), f"Provider {p_name} is not a BaseLLMProvider"
        valid, msg = provider.verify_key("")
        print(f"  ✔ Provider '{p_name}': {provider.__class__.__name__} -> verify_key: {valid} ({msg})")

    # 3. Test Mock Provider Streaming
    print("\n[Test 3] Testing Mock Provider streaming...")
    mock_provider = LLMProviderFactory.get_provider("mock")
    tokens = []
    async for token in mock_provider.stream_chat(
        system_prompt="Test system prompt",
        user_prompt="Refactor validateToken",
        model="deterministic-mock-v1",
    ):
        tokens.append(token)

    assert len(tokens) > 0, "No tokens yielded by mock provider"
    print(f"  ✔ Mock provider streamed {len(tokens)} chunks successfully.")

    # 4. Test Key Verification logic
    print("\n[Test 4] Testing API key verification error handling...")
    openai_provider = LLMProviderFactory.get_provider("openai")
    valid_key, msg = openai_provider.verify_key("sk-invalid-test-key")
    assert not valid_key, "Invalid key was incorrectly marked valid"
    print(f"  ✔ Correctly rejected fake OpenAI key: {msg}")

    print("\n" + "=" * 65)
    print("🎉 ALL LLM PROVIDER TESTS PASSED!")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(run_tests())
