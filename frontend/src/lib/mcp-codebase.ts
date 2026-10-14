export interface NodeCodeItem {
  id: string;
  name: string;
  file: string;
  type: "File" | "Function" | "Class" | "Module" | "Endpoint";
  language: "python" | "bash" | "json" | "markdown" | "toml";
  code: string;
  description: string;
}

export const MCP_CODEBASE_REGISTRY: Record<string, NodeCodeItem> = {
  "asgi.py": {
    id: "asgi.py",
    name: "asgi.py",
    file: "src/asgi.py",
    type: "File",
    language: "python",
    description: "ASGI HTTP and WebSocket protocol handler for FastAPI Worker MCP Server.",
    code: `"""ASGI application and WebSocket connection manager."""

import asyncio
import json
import logging
from typing import Any, Callable, Dict, Optional
from src.exceptions import ProtocolError, WebSocketClosed
from src.logger import setup_logger

logger = setup_logger("asgi")

class ASGI:
    """Core ASGI 3.0 interface adapter."""

    def __init__(self, app: Any):
        self.app = app
        self._is_running = False
        self._active_connections: Dict[str, Any] = {}

    async def __call__(self, scope: Dict[str, Any], receive: Callable, send: Callable) -> None:
        scope_type = scope.get("type")
        if scope_type == "http":
            await self.fetch(scope, receive, send)
        elif scope_type == "websocket":
            await self.websocket(scope, receive, send)
        elif scope_type == "lifespan":
            await self.handle_lifespan(scope, receive, send)
        else:
            raise ProtocolError(f"Unsupported scope type: {scope_type}")

    async def fetch(self, scope: Dict[str, Any], receive: Callable, send: Callable) -> None:
        """Route standard HTTP requests to request processor."""
        path = scope.get("path", "/")
        logger.info(f"Incoming HTTP request: {path}")
        await self.process_request(scope, receive, send)

    async def websocket(self, scope: Dict[str, Any], receive: Callable, send: Callable) -> None:
        """Handle incoming WebSocket connection lifecycle."""
        await self.process_websocket(scope, receive, send)

    async def process_websocket(self, scope: Dict[str, Any], receive: Callable, send: Callable) -> None:
        """Process bidirectional WebSocket messages and dispatch tool events."""
        connection_id = scope.get("client", ["anonymous"])[0]
        logger.info(f"WebSocket client connected: {connection_id}")
        await self.onopen(connection_id, send)
        
        buffer = await self.acquire_ws_buffer(connection_id)
        try:
            while True:
                message = await self.ws_receive(receive)
                if message.get("type") == "websocket.disconnect":
                    break
                await self.onmessage(connection_id, message, send)
        except WebSocketClosed:
            logger.warning(f"Connection closed by peer: {connection_id}")
        finally:
            await self.onclose(connection_id)

    async def onopen(self, client_id: str, send: Callable) -> None:
        await self.ws_send(send, {"type": "websocket.accept"})

    async def onmessage(self, client_id: str, message: Dict[str, Any], send: Callable) -> None:
        data = message.get("text") or message.get("bytes")
        logger.debug(f"Received payload from {client_id}: {data}")
        asyncio.create_task(self.background_task(client_id, data, send))

    async def onclose(self, client_id: str) -> None:
        logger.info(f"Cleaning up resources for: {client_id}")

    async def ws_receive(self, receive: Callable) -> Dict[str, Any]:
        return await receive()

    async def ws_send(self, send: Callable, payload: Dict[str, Any]) -> None:
        await send(payload)

    async def acquire_ws_buffer(self, client_id: str) -> bytearray:
        return bytearray()

    async def background_task(self, client_id: str, data: Any, send: Callable) -> None:
        pass
`,
  },

  "process_websocket": {
    id: "process_websocket",
    name: "process_websocket",
    file: "src/asgi.py",
    type: "Function",
    language: "python",
    description: "Main asynchronous WebSocket loop handling bidirectional frames, buffers, and dispatches.",
    code: `async def process_websocket(
    self, 
    scope: Dict[str, Any], 
    receive: Callable, 
    send: Callable
) -> None:
    """Process bidirectional WebSocket messages and dispatch tool events."""
    connection_id = scope.get("client", ["anonymous"])[0]
    logger.info(f"WebSocket client connected: {connection_id}")
    
    # 1. Accept handshake
    await self.onopen(connection_id, send)
    
    # 2. Acquire shared buffer for streaming
    buffer = await self.acquire_ws_buffer(connection_id)
    
    try:
        while True:
            # 3. Asynchronously await incoming frame
            message = await self.ws_receive(receive)
            
            if message.get("type") == "websocket.disconnect":
                logger.info(f"Disconnect signal received for {connection_id}")
                break
                
            # 4. Handle tool call request
            await self.onmessage(connection_id, message, send)
            
    except WebSocketClosed:
        logger.warning(f"Connection closed abruptly: {connection_id}")
    finally:
        # 5. Flush state and close cleanly
        await self.onclose(connection_id)
`,
  },

  "FastMCPServer": {
    id: "FastMCPServer",
    name: "FastMCPServer",
    file: "src/worker.py",
    type: "Class",
    language: "python",
    description: "Model Context Protocol Server implementation exposing registered tools and resources.",
    code: `class FastMCPServer:
    """Core Model Context Protocol Server."""

    def __init__(self, name: str = "fastapi-worker-dani-mcp-server", version: str = "1.0.0"):
        self.name = name
        self.version = version
        self.tools: Dict[str, Callable] = {}
        self.prompts: Dict[str, Callable] = {}
        self.resources: Dict[str, Any] = {}

    def register_tool(self, name: str, handler: Callable) -> None:
        """Register an executable MCP tool function."""
        self.tools[name] = handler
        logger.info(f"Registered MCP tool: '{name}'")

    def register_prompt(self, name: str, handler: Callable) -> None:
        """Register a reusable prompt template."""
        self.prompts[name] = handler

    async def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        if tool_name not in self.tools:
            raise KeyError(f"Tool '{tool_name}' not found on server '{self.name}'.")
        handler = self.tools[tool_name]
        return await handler(**arguments)
`,
  },

  "setup_server": {
    id: "setup_server",
    name: "setup_server",
    file: "src/worker.py",
    type: "Function",
    language: "python",
    description: "Registers MCP tools: calculate_bmi, add, echo_prompt, and get_greeting.",
    code: `def setup_server(server: FastMCPServer) -> FastMCPServer:
    """Register all available tools and prompts with the MCP server."""
    
    @server.tool(name="calculate_bmi", description="Compute Body Mass Index")
    async def calculate_bmi(weight_kg: float, height_m: float) -> Dict[str, Any]:
        bmi = round(weight_kg / (height_m ** 2), 2)
        category = "Normal" if 18.5 <= bmi <= 24.9 else "Underweight" if bmi < 18.5 else "Overweight"
        return {"bmi": bmi, "category": category}

    @server.tool(name="add", description="Calculate sum of two numbers")
    async def add(a: float, b: float) -> float:
        return a + b

    @server.prompt(name="echo_prompt")
    def echo_prompt(text: str) -> str:
        return f"User Prompt: {text}"

    @server.prompt(name="get_greeting")
    def get_greeting(name: str) -> str:
        return f"Hello, {name}! Connected to FastMCPServer."

    return server
`,
  },

  "calculate_bmi": {
    id: "calculate_bmi",
    name: "calculate_bmi",
    file: "src/worker.py",
    type: "Function",
    language: "python",
    description: "MCP tool computing Body Mass Index and classification category.",
    code: `async def calculate_bmi(weight_kg: float, height_m: float) -> Dict[str, Any]:
    """Compute Body Mass Index given weight in kilograms and height in meters."""
    if height_m <= 0:
        raise ValueError("Height must be strictly positive.")
    bmi = round(weight_kg / (height_m ** 2), 2)
    category = "Normal" if 18.5 <= bmi <= 24.9 else "Underweight" if bmi < 18.5 else "Overweight"
    return {
        "weight_kg": weight_kg,
        "height_m": height_m,
        "bmi": bmi,
        "category": category
    }
`,
  },

  "worker.py": {
    id: "worker.py",
    name: "worker.py",
    file: "src/worker.py",
    type: "File",
    language: "python",
    description: "Worker process entrypoint initializing MCP server and tool bindings.",
    code: `"""Worker entrypoint for Cloudflare Workers / Python ASGI runtime."""

from src.asgi import ASGI
from src.logger import setup_logger
from src.server import FastMCPServer, setup_server

logger = setup_logger("worker")

server = FastMCPServer("fastapi-worker-dani-mcp-server")
setup_server(server)

app = ASGI(server)

async def on_fetch(request, env):
    """Entrypoint for HTTP fetch events in worker environment."""
    return await app.fetch(request)
`,
  },

  "logger.py": {
    id: "logger.py",
    name: "logger.py",
    file: "src/logger.py",
    type: "File",
    language: "python",
    description: "Structured logging configuration with timestamps and log levels.",
    code: `"""Structured logging configuration."""

import logging
import sys

def setup_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt='{"time": "%(asctime)s", "level": "%(levelname)s", "module": "%(name)s", "msg": "%(message)s"}',
            datefmt="%Y-%m-%dT%H:%M:%SZ"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger
`,
  },

  "exceptions.py": {
    id: "exceptions.py",
    name: "exceptions.py",
    file: "src/exceptions.py",
    type: "File",
    language: "python",
    description: "Custom protocol exception hierarchy for MCP server.",
    code: `"""Custom exceptions for MCP WebSocket and ASGI protocols."""

class ProtocolError(Exception):
    """Raised when an invalid or unsupported ASGI scope is received."""
    pass

class WebSocketClosed(Exception):
    """Raised when a WebSocket connection terminates abruptly."""
    pass

class ToolExecutionError(Exception):
    """Raised when an MCP tool fails during runtime execution."""
    pass
`,
  },

  "pyproject.toml": {
    id: "pyproject.toml",
    name: "pyproject.toml",
    file: "pyproject.toml",
    type: "File",
    language: "toml",
    description: "Package configuration and dependency requirements.",
    code: `[project]
name = "fastapi-worker-dani-mcp-server"
version = "0.1.0"
description = "FastAPI MCP Server optimized for worker runtimes"
authors = [{ name = "Dani", email = "dani@example.com" }]
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn>=0.32.0",
    "pydantic>=2.9.0",
]
`,
  },
};
