"""Model Context Protocol (MCP) Standard Server for FalkorDB AST & Memory.

Exposes graph intelligence tools over standard MCP (stdio / SSE) for AI agents:
1. get_ast_blast_radius
2. retrieve_code_memory
3. get_ast_centrality
4. query_code_provenance
"""

from __future__ import annotations

import sys
import os

# Ensure backend root is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from mcp.server.fastmcp import FastMCP
except (ImportError, ModuleNotFoundError):
    from mcp.server.mcpserver import MCPServer as FastMCP

from services.falkor_client import get_falkor_service

mcp = FastMCP("FalkorDB-AST-Orchestrator")


@mcp.tool()
def get_ast_blast_radius(function_name: str, max_depth: int = 4) -> str:
    """Calculates all downstream dependents that will break if this function is modified."""
    falkor = get_falkor_service()
    query = """
    MATCH path = (root:Function {name: $name})<-[:CALLS*1..4]-(dependent:Function)
    RETURN dependent.name AS function_name, dependent.file AS file_path, length(path) AS hop_distance
    ORDER BY hop_distance ASC
    """
    try:
        res = falkor.graph.query(query, {"name": function_name})
        if not res.result_set:
            return f"No downstream callers found for {function_name}. Modification blast radius is 0."
        return "\n".join([f"Hop {row[2]}: {row[0]} in {row[1]}" for row in res.result_set])
    except Exception as exc:
        return f"Error executing FalkorDB blast radius: {exc}"


@mcp.tool()
def retrieve_code_memory(function_name: str) -> str:
    """Retrieves all past procedural constraints, guardrails, and failure memories linked to this node."""
    falkor = get_falkor_service()
    query = """
    MATCH (fn:Function {name: $name})-[:HAS_RULE|CONSTRAINED_BY]->(m)
    RETURN coalesce(m.rule, m.constraint) AS rule, coalesce(m.severity, m.type) AS meta
    """
    try:
        res = falkor.graph.query(query, {"name": function_name})
        if not res.result_set:
            return f"No procedural guardrails found for {function_name}."
        return "\n".join([f"- [{row[1]}] {row[0]}" for row in res.result_set])
    except Exception as exc:
        return f"Error executing FalkorDB memory retrieval: {exc}"


@mcp.tool()
def get_ast_centrality() -> str:
    """Calculates PageRank / Betweenness centrality ranking for AST nodes in FalkorDB."""
    falkor = get_falkor_service()
    scores = falkor.calculate_ast_centrality()
    if not scores:
        return "No centrality scores available."
    return "\n".join([f"{fn}: {score}" for fn, score in scores.items()])


@mcp.tool()
def query_code_provenance(function_name: str) -> str:
    """Fetches author, ticket, and PR history for a function from Company Brain graph."""
    falkor = get_falkor_service()
    query = """
    MATCH (fn:Function {name: $name})<-[:TOUCHES]-(pr:PR)-[:AUTHORED_BY]->(e:Engineer),
          (pr)-[:RESOLVES]->(t:Ticket)
    RETURN pr.number AS pr, pr.summary AS summary, e.handle AS engineer, t.key AS ticket
    """
    try:
        res = falkor.graph.query(query, {"name": function_name})
        if not res.result_set:
            return f"No Git/Jira provenance found for {function_name}."
        row = res.result_set[0]
        return f"Authored by {row[2]} in PR #{row[0]} ({row[1]}) resolving Ticket {row[3]}."
    except Exception as exc:
        return f"Error executing FalkorDB provenance query: {exc}"


if __name__ == "__main__":
    mcp.run(transport="stdio")
