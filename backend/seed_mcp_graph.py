#!/usr/bin/env python3
"""Seed the exact fastapi-worker-dani-mcp-server AST code graph into FalkorDB."""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.falkor_client import get_falkor_service

def seed_mcp_graph():
    falkor = get_falkor_service()
    if not falkor.is_healthy():
        print("FalkorDB is not reachable.")
        return False

    print("Connected to FalkorDB. Clearing previous graph...")
    try:
        falkor.query("MATCH (n) DETACH DELETE n")
    except Exception as e:
        print(f"Clear error: {e}")

    print("Seeding fastapi-worker-dani-mcp-server nodes and relationships...")

    # Node definitions: (id, name, type, layer, category)
    nodes = [
        # Blue: Modules / Root / Endpoints
        ("root", "root", "Module", "module", "#0284c7"),
        ("src", "src", "Module", "module", "#0284c7"),
        ("tests", "tests", "Module", "module", "#0284c7"),
        ("add", "add", "Endpoint", "function", "#0284c7"),
        ("fetch", "fetch", "Endpoint", "function", "#0284c7"),
        ("websocket", "websocket", "Endpoint", "function", "#0284c7"),

        # Purple: Files
        ("worker.py", "worker.py", "File", "file", "#8b5cf6"),
        ("logger.py", "logger.py", "File", "file", "#8b5cf6"),
        ("asgi.py", "asgi.py", "File", "file", "#8b5cf6"),
        ("exceptions.py", "exceptions.py", "File", "file", "#8b5cf6"),
        ("uvicorn.py", "uvicorn.py", "File", "file", "#8b5cf6"),
        ("build.sh", "build.sh", "File", "file", "#8b5cf6"),
        ("vendor.txt", "vendor.txt", "File", "file", "#8b5cf6"),
        ("package.json", "package.json", "File", "file", "#8b5cf6"),
        ("README.md", "README.md", "File", "file", "#8b5cf6"),
        ("requirements-test.txt", "requirements-test.txt", "File", "file", "#8b5cf6"),
        ("package-lock.json", "package-lock.json", "File", "file", "#8b5cf6"),
        ("pyproject.toml", "pyproject.toml", "File", "file", "#8b5cf6"),

        # Green: Servers / Classes / Background
        ("FastMCPServer", "FastMCPServer", "Class", "service", "#10b981"),
        ("ASGI", "ASGI", "Class", "service", "#10b981"),
        ("background_task", "background_task", "Class", "service", "#10b981"),

        # Cyan: Functions / Handlers / Methods
        ("setup_server", "setup_server", "Function", "function", "#06b6d4"),
        ("echo_prompt", "echo_prompt", "Function", "function", "#06b6d4"),
        ("get_greeting", "get_greeting", "Function", "function", "#06b6d4"),
        ("calculate_bmi", "calculate_bmi", "Function", "function", "#06b6d4"),
        ("on_fetch", "on_fetch", "Function", "function", "#06b6d4"),
        ("ws_receive", "ws_receive", "Function", "function", "#06b6d4"),
        ("onmessage", "onmessage", "Function", "function", "#06b6d4"),
        ("process_request", "process_request", "Function", "function", "#06b6d4"),
        ("process_websocket", "process_websocket", "Function", "function", "#06b6d4"),
        ("onopen", "onopen", "Function", "function", "#06b6d4"),
        ("onclose", "onclose", "Function", "function", "#06b6d4"),
        ("ws_send", "ws_send", "Function", "function", "#06b6d4"),
        ("getattr", "getattr", "Function", "function", "#06b6d4"),
        ("shutdown", "shutdown", "Function", "function", "#06b6d4"),
        ("start_application", "start_application", "Function", "function", "#06b6d4"),
        ("receive", "receive", "Function", "function", "#06b6d4"),
        ("send", "send", "Function", "function", "#06b6d4"),
        ("acquire_ws_buffer", "acquire_ws_buffer", "Function", "function", "#06b6d4"),
    ]

    for nid, name, ntype, layer, color in nodes:
        cypher = """
        MERGE (n:Node {id: $id})
        SET n.name = $name, n.type = $type, n.layer = $layer, n.color = $color, n.label = $name
        """
        falkor.query(cypher, {"id": nid, "name": name, "type": ntype, "layer": layer, "color": color})

    # Relationships: (source, rel, target)
    edges = [
        # Root links
        ("root", "CONTAINS", "src"),
        ("root", "CONTAINS", "tests"),
        ("root", "CONTAINS", "build.sh"),
        ("root", "CONTAINS", "vendor.txt"),
        ("root", "CONTAINS", "package.json"),
        ("root", "CONTAINS", "README.md"),
        ("root", "CONTAINS", "package-lock.json"),
        ("root", "CONTAINS", "requirements-test.txt"),
        ("root", "CONTAINS", "pyproject.toml"),
        ("root", "CONTAINS", "uvicorn.py"),

        # src links
        ("src", "CONTAINS", "worker.py"),
        ("src", "CONTAINS", "logger.py"),
        ("src", "CONTAINS", "asgi.py"),
        ("src", "CONTAINS", "exceptions.py"),
        ("src", "DEFINES", "onmessage"),
        ("src", "DEFINES", "process_request"),
        ("src", "DEFINES", "onopen"),

        # worker.py links
        ("worker.py", "IMPORTS", "setup_server"),
        ("worker.py", "INITIALIZES", "FastMCPServer"),
        ("worker.py", "HANDLES", "on_fetch"),
        ("worker.py", "IMPORTS", "logger.py"),
        ("worker.py", "IMPORTS", "exceptions.py"),

        # setup_server links
        ("setup_server", "REGISTERS", "calculate_bmi"),
        ("setup_server", "REGISTERS", "add"),
        ("setup_server", "REGISTERS", "echo_prompt"),
        ("setup_server", "REGISTERS", "get_greeting"),
        ("FastMCPServer", "PROVIDES", "calculate_bmi"),
        ("FastMCPServer", "PROVIDES", "setup_server"),

        # logger.py links
        ("logger.py", "CONFIGURES", "setup_server"),
        ("logger.py", "ATTACHED_TO", "asgi.py"),

        # asgi.py links
        ("asgi.py", "DEFINES", "ASGI"),
        ("asgi.py", "HANDLES", "process_websocket"),
        ("asgi.py", "CALLS", "ws_send"),
        ("asgi.py", "CALLS", "ws_receive"),
        ("asgi.py", "HANDLES", "onopen"),
        ("asgi.py", "HANDLES", "onclose"),
        ("asgi.py", "EXPOSES", "fetch"),
        ("asgi.py", "EXPOSES", "websocket"),
        ("asgi.py", "LIFECYCLE", "shutdown"),
        ("asgi.py", "LIFECYCLE", "start_application"),
        ("asgi.py", "CALLS", "getattr"),

        # process_websocket links
        ("process_websocket", "CALLS", "ws_receive"),
        ("process_websocket", "CALLS", "ws_send"),
        ("process_websocket", "DISPATCHES", "onclose"),
        ("process_websocket", "DISPATCHES", "onopen"),
        ("process_websocket", "CALLS", "acquire_ws_buffer"),
        ("process_websocket", "TRIGGERS", "background_task"),

        # ASGI links
        ("ASGI", "STARTS", "start_application"),
        ("ASGI", "DISPATCHES", "shutdown"),
        ("ASGI", "CALLS", "receive"),
        ("ASGI", "CALLS", "send"),
        ("ASGI", "HANDLES", "ws_send"),

        # fetch & endpoints
        ("fetch", "DELEGATES", "process_request"),
        ("fetch", "CALLS", "getattr"),
        ("websocket", "ROUTES_TO", "asgi.py"),
        ("start_application", "CALLS", "receive"),
        ("start_application", "CALLS", "send"),
        ("start_application", "TRIGGERS", "shutdown"),
    ]

    for src, rel, tgt in edges:
        cypher = f"""
        MATCH (a:Node {{id: $src}}), (b:Node {{id: $tgt}})
        MERGE (a)-[r:{rel}]->(b)
        """
        falkor.query(cypher, {"src": src, "tgt": tgt})

    print(f"Successfully seeded {len(nodes)} nodes and {len(edges)} relationships into FalkorDB!")
    return True

if __name__ == "__main__":
    seed_mcp_graph()
