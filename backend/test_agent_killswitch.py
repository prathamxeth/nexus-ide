"""Kill-Switch and FalkorDB Hardwiring Verification Suite.

Tests:
- Test 1: With FalkorDB connected, agent streams graph traversal (visitedBlockIds, activeConnections),
  resolves procedural context, and synthesizes code_patch.
- Test 2: If FalkorDB client is disconnected or unreachable on port 6379, agent aborts immediately
  and emits zero code.
"""

import asyncio
import json
from typing import Any, Dict, List, Tuple
from unittest.mock import MagicMock

from services.agent_orchestrator import AgentOrchestrator, SYSTEM_PROMPT_MANDATE
from services.agent_tools import (
    falkor_blast_radius,
    falkor_episodic_memory,
    falkor_provenance,
    check_falkor_health,
)
from services.falkor_client import get_falkor_service

SAMPLE_CODE = """export function validateToken(token: string): boolean {
  if (!token) return false;
  return decodePayload(token) !== null;
}
"""


def parse_sse_stream(raw_events: List[str]) -> List[Tuple[str, Dict[str, Any]]]:
    """Parse raw SSE chunks ('event: ...\\ndata: ...\\n\\n') into structured tuples."""
    parsed: List[Tuple[str, Dict[str, Any]]] = []
    current_event = "message"

    for chunk in raw_events:
        lines = chunk.strip().split("\n")
        data_lines = []
        for line in lines:
            if line.startswith("event: "):
                current_event = line[len("event: "):].strip()
            elif line.startswith("data: "):
                data_lines.append(line[len("data: "):].strip())

        if data_lines:
            try:
                payload = json.loads("\n".join(data_lines))
                parsed.append((current_event, payload))
            except json.JSONDecodeError:
                pass

    return parsed


async def run_test_falkordb_connected():
    print("=" * 65)
    print("🧪 Test 1: Agent with Active FalkorDB Connection")
    print("=" * 65)

    falkor = get_falkor_service()
    if not falkor.is_healthy():
        print("❌ Error: FalkorDB is not reachable on port 6379 for Test 1.")
        assert False, "FalkorDB must be running on port 6379 for Test 1"

    orchestrator = AgentOrchestrator(falkor_service=falkor)

    raw_chunks: List[str] = []
    async for chunk in orchestrator.stream_refactor(
        prompt="Refactor validateToken to enforce 60s clock skew tolerance",
        target_function="validateToken",
        code=SAMPLE_CODE,
        file_path="src/auth.ts",
        provider="mock",
    ):
        raw_chunks.append(chunk)

    events = parse_sse_stream(raw_chunks)
    event_names = [e[0] for e in events]
    print(f"✔ Emitted SSE events in order: {event_names}")

    # 1. Verify graph_traversal event
    assert "graph_traversal" in event_names, "Missing 'graph_traversal' SSE event!"
    traversal_event = next(e[1] for e in events if e[0] == "graph_traversal")
    assert "visitedBlockIds" in traversal_event, "Missing 'visitedBlockIds' in graph_traversal!"
    assert "activeConnections" in traversal_event, "Missing 'activeConnections' in graph_traversal!"
    print(f"✔ graph_traversal verified: {len(traversal_event['visitedBlockIds'])} visitedBlockIds, {len(traversal_event['activeConnections'])} activeConnections")

    # 2. Verify context_resolved event
    assert "context_resolved" in event_names, "Missing 'context_resolved' SSE event!"
    context_event = next(e[1] for e in events if e[0] == "context_resolved")
    assert context_event["target_function"] == "validateToken"
    assert "rules" in context_event
    assert "dependents" in context_event
    assert context_event.get("falkordb_verified") is True
    print(f"✔ context_resolved verified: {len(context_event['rules'])} memory rules, {context_event['blast_radius_count']} dependents")

    # 3. Verify reasoning_chunk events
    assert "reasoning_chunk" in event_names, "Missing 'reasoning_chunk' tokens!"

    # 4. Verify code_patch event
    assert "code_patch" in event_names, "Missing 'code_patch' event when FalkorDB is live!"
    patch_event = next(e[1] for e in events if e[0] == "code_patch")
    assert "modified_code" in patch_event and len(patch_event["modified_code"]) > 0
    assert "clockTolerance" in patch_event["modified_code"]
    print("✔ code_patch verified with safe FalkorDB AST patch.")

    # 5. Verify done event
    done_event = next(e[1] for e in events if e[0] == "done")
    assert done_event["status"] == "completed"
    assert done_event["code_generated"] is True

    print("🎉 Test 1 PASSED: Agent successfully streamed traversal, context, reasoning, and patch!")


async def run_test_falkordb_disconnected_killswitch():
    print("\n" + "=" * 65)
    print("🧪 Test 2: FalkorDB Disconnected — Strict Kill-Switch & Zero Code")
    print("=" * 65)

    # Create mock disconnected FalkorDB client
    mock_falkor = MagicMock()
    mock_falkor.is_healthy.return_value = False
    mock_falkor.ping.return_value = False
    mock_falkor.query.side_effect = ConnectionError("FalkorDB connection failed on port 6379: connection refused")

    # Verify check_falkor_health triggers ConnectionError
    try:
        check_falkor_health(mock_falkor)
        assert False, "check_falkor_health should raise ConnectionError when disconnected!"
    except ConnectionError as ce:
        print(f"✔ check_falkor_health properly raised ConnectionError: {ce}")

    # Verify falkor_blast_radius triggers ConnectionError
    try:
        falkor_blast_radius("validateToken", falkor_service=mock_falkor)
        assert False, "falkor_blast_radius should raise ConnectionError when disconnected!"
    except ConnectionError:
        print("✔ falkor_blast_radius properly triggered kill-switch ConnectionError.")

    # Verify falkor_episodic_memory triggers ConnectionError
    try:
        falkor_episodic_memory("validateToken", falkor_service=mock_falkor)
        assert False, "falkor_episodic_memory should raise ConnectionError when disconnected!"
    except ConnectionError:
        print("✔ falkor_episodic_memory properly triggered kill-switch ConnectionError.")

    # Verify falkor_provenance triggers ConnectionError
    try:
        falkor_provenance("validateToken", falkor_service=mock_falkor)
        assert False, "falkor_provenance should raise ConnectionError when disconnected!"
    except ConnectionError:
        print("✔ falkor_provenance properly triggered kill-switch ConnectionError.")

    # Test orchestrator loop under disconnected FalkorDB
    orchestrator = AgentOrchestrator(falkor_service=mock_falkor)

    raw_chunks: List[str] = []
    async for chunk in orchestrator.stream_refactor(
        prompt="Refactor validateToken",
        target_function="validateToken",
        code=SAMPLE_CODE,
        file_path="src/auth.ts",
        provider="mock",
    ):
        raw_chunks.append(chunk)

    events = parse_sse_stream(raw_chunks)
    event_names = [e[0] for e in events]
    print(f"✔ Disconnected agent emitted events: {event_names}")

    # CRITICAL ASSERTIONS:
    # 1. Zero code must be generated (NO code_patch event!)
    assert "code_patch" not in event_names, "CRITICAL KILL-SWITCH FAILURE: code_patch was emitted despite FalkorDB disconnection!"

    # 2. Agent must emit abort event
    assert "abort" in event_names, "Agent must emit 'abort' event on FalkorDB failure!"
    abort_event = next(e[1] for e in events if e[0] == "abort")
    assert abort_event.get("kill_switch") is True

    # 3. Agent must emit done event with code_generated = False
    done_event = next(e[1] for e in events if e[0] == "done")
    assert done_event["status"] == "aborted"
    assert done_event["code_generated"] is False
    assert done_event["total_patches"] == 0

    # 4. Check refusal message mentions the mandate
    reasoning_events = [e[1]["chunk"] for e in events if e[0] == "reasoning_chunk"]
    reasoning_text = "".join(reasoning_events)
    assert "Refusal" in reasoning_text
    assert "You are GraphiCode Agent. You have NO native file reading tools." in reasoning_text
    assert "zero code generated" in reasoning_text.lower()
    print("✔ Refusal text verified with required GraphiCode Agent mandate.")

    print("🎉 Test 2 PASSED: Kill-switch successfully aborted execution and emitted ZERO code!")


def main():
    asyncio.run(run_test_falkordb_connected())
    asyncio.run(run_test_falkordb_disconnected_killswitch())
    print("\n" + "=" * 65)
    print("🏆 ALL FALKORDB AGENT KILL-SWITCH TESTS PASSED PERFECTLY!")
    print("=" * 65)


if __name__ == "__main__":
    main()
