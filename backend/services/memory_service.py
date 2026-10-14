"""Persistent Procedural Memory & Enterprise Context Service for Nexus IDE.

Manages recording of agent action failures, procedural resolution rules,
and git PR / ticket attribution in the FalkorDB knowledge graph.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from services.falkor_client import FalkorService, get_falkor_service

logger = logging.getLogger("nexus.services.memory")


class MemoryService:
    """Service managing agent procedural memory, failure tracking, and company context."""

    def __init__(self, falkor_service: Optional[FalkorService] = None) -> None:
        self._falkor = falkor_service or get_falkor_service()

    @property
    def falkor(self) -> FalkorService:
        """Active FalkorDB service client."""
        return self._falkor

    def record_action_failure(
        self,
        session_id: str,
        function_name: str,
        patch_diff: str,
        error_message: str,
    ) -> Dict[str, Any]:
        """Record an agent's failed patch execution against a specific function.

        Creates:
        - MERGE (s:Session {id: $session_id})
        - CREATE (a:Action {patch: $patch, status: "FAILED", error: $err, timestamp: timestamp()})
        - MERGE (fn:Function {name: $function_name})
        - CREATE (s)-[:EXECUTED]->(a)
        - CREATE (a)-[:FAILED_ON]->(fn)
        """
        cypher = (
            "MERGE (s:Session {id: $session_id}) "
            "CREATE (a:Action {patch: $patch, status: 'FAILED', error: $err, timestamp: timestamp()}) "
            "MERGE (fn:Function {name: $function_name}) "
            "CREATE (s)-[:EXECUTED]->(a) "
            "CREATE (a)-[:FAILED_ON]->(fn) "
            "RETURN a.status AS status, a.error AS error, a.timestamp AS timestamp"
        )
        params = {
            "session_id": session_id,
            "patch": patch_diff,
            "err": error_message,
            "function_name": function_name,
        }
        try:
            results = self.falkor.query(cypher, params)
            logger.info("Recorded action failure for '%s' in session '%s'", function_name, session_id)
            return {
                "success": True,
                "session_id": session_id,
                "function_name": function_name,
                "status": results[0][0] if results else "FAILED",
                "error": results[0][1] if results else error_message,
                "timestamp": results[0][2] if results and len(results[0]) > 2 else None,
            }
        except Exception as exc:
            logger.error("Failed to record action failure: %s", exc)
            raise

    def record_action_resolution(
        self,
        action_error: str,
        resolved_rule: str,
        function_name: str,
    ) -> Dict[str, Any]:
        """Record a persistent procedural memory rule synthesized after resolving an error.

        Creates:
        - MERGE (fn:Function {name: $function_name})
        - CREATE (m:Memory {type: "procedural", rule: $resolved_rule, timestamp: timestamp()})
        - CREATE (fn)-[:HAS_RULE]->(m)
        """
        cypher = (
            "MERGE (fn:Function {name: $function_name}) "
            "CREATE (m:Memory {type: 'procedural', rule: $resolved_rule, error_context: $action_error, timestamp: timestamp()}) "
            "CREATE (fn)-[:HAS_RULE]->(m) "
            "RETURN m.rule AS rule, m.type AS type, m.timestamp AS timestamp"
        )
        params = {
            "function_name": function_name,
            "resolved_rule": resolved_rule,
            "action_error": action_error,
        }
        try:
            results = self.falkor.query(cypher, params)
            logger.info("Recorded procedural rule for '%s': '%s'", function_name, resolved_rule)
            return {
                "success": True,
                "function_name": function_name,
                "rule": results[0][0] if results else resolved_rule,
                "type": results[0][1] if results else "procedural",
                "timestamp": results[0][2] if results and len(results[0]) > 2 else None,
            }
        except Exception as exc:
            logger.error("Failed to record action resolution: %s", exc)
            raise

    def fetch_memory_rules(self, function_name: str) -> List[str]:
        """Fetch historical procedural rules and past pitfalls associated with a function.

        Matches:
        - (fn:Function {name: $function_name})-[:HAS_RULE]->(m:Memory)
        Returns: list[str]
        """
        cypher = (
            "MATCH (fn:Function {name: $function_name})-[:HAS_RULE]->(m:Memory) "
            "RETURN m.rule AS rule "
            "ORDER BY m.timestamp DESC"
        )
        params = {"function_name": function_name}
        try:
            results = self.falkor.query(cypher, params)
            # Deduplicate while preserving recency order
            rules: List[str] = []
            seen = set()
            for row in results:
                rule_text = str(row[0])
                if rule_text not in seen:
                    seen.add(rule_text)
                    rules.append(rule_text)
            logger.debug("Fetched %d memory rules for '%s'", len(rules), function_name)
            return rules
        except Exception as exc:
            logger.error("Failed to fetch memory rules for '%s': %s", function_name, exc)
            raise

    def seed_company_context(
        self,
        file_path: str,
        function_name: str,
        author_handle: str,
        pr_number: int,
        pr_title: str,
        ticket_key: str,
    ) -> Dict[str, Any]:
        """Seed organizational metadata linking Engineer, Pull Request, Ticket, and Function.

        Creates:
        - MERGE (dev:Engineer {handle: $author_handle})
        - MERGE (pr:PR {id: $pr_number, title: $pr_title})
        - MERGE (t:Ticket {key: $ticket_key})
        - MERGE (fn:Function {name: $function_name})
        - MERGE (dev)-[:AUTHORED]->(pr)
        - MERGE (pr)-[:RESOLVES]->(t)
        - MERGE (pr)-[:MODIFIED]->(fn)
        """
        cypher = (
            "MERGE (dev:Engineer {handle: $author_handle}) "
            "MERGE (pr:PR {id: $pr_number, title: $pr_title}) "
            "MERGE (t:Ticket {key: $ticket_key}) "
            "MERGE (fn:Function {name: $function_name}) "
            "MERGE (dev)-[:AUTHORED]->(pr) "
            "MERGE (pr)-[:RESOLVES]->(t) "
            "MERGE (pr)-[:MODIFIED]->(fn) "
            "WITH dev, pr, t, fn "
            "MATCH (file:File {path: $file_path}) "
            "MERGE (file)-[:DEFINES]->(fn) "
            "RETURN dev.handle AS engineer, pr.id AS pr_id, t.key AS ticket, fn.name AS function"
        )
        # If the file node doesn't exist yet, we ensure the file is merged as well
        fallback_cypher = (
            "MERGE (dev:Engineer {handle: $author_handle}) "
            "MERGE (pr:PR {id: $pr_number, title: $pr_title}) "
            "MERGE (t:Ticket {key: $ticket_key}) "
            "MERGE (f:File {path: $file_path}) "
            "MERGE (fn:Function {name: $function_name}) "
            "SET fn.file = $file_path "
            "MERGE (dev)-[:AUTHORED]->(pr) "
            "MERGE (pr)-[:RESOLVES]->(t) "
            "MERGE (pr)-[:MODIFIED]->(fn) "
            "MERGE (f)-[:DEFINES]->(fn) "
            "RETURN dev.handle AS engineer, pr.id AS pr_id, t.key AS ticket, fn.name AS function"
        )
        params = {
            "file_path": file_path,
            "function_name": function_name,
            "author_handle": author_handle,
            "pr_number": pr_number,
            "pr_title": pr_title,
            "ticket_key": ticket_key,
        }
        try:
            results = self.falkor.query(fallback_cypher, params)
            logger.info(
                "Linked context: %s -> PR #%d (%s) -> Ticket %s -> Function %s",
                author_handle,
                pr_number,
                pr_title,
                ticket_key,
                function_name,
            )
            return {
                "success": True,
                "engineer": results[0][0] if results else author_handle,
                "pr_number": results[0][1] if results else pr_number,
                "ticket_key": results[0][2] if results else ticket_key,
                "function_name": results[0][3] if results else function_name,
            }
        except Exception as exc:
            logger.error("Failed to seed company context: %s", exc)
            raise

    def fetch_function_context(self, function_name: str) -> Dict[str, Any]:
        """Fetch all historical PRs, resolving tickets, authors, and rules for a function."""
        cypher = (
            "MATCH (pr:PR)-[:MODIFIED]->(fn:Function {name: $name}) "
            "OPTIONAL MATCH (dev:Engineer)-[:AUTHORED]->(pr) "
            "OPTIONAL MATCH (pr)-[:RESOLVES]->(t:Ticket) "
            "RETURN pr.id AS pr_id, pr.title AS pr_title, dev.handle AS author, t.key AS ticket"
        )
        rules = self.fetch_memory_rules(function_name)
        try:
            pr_rows = self.falkor.query(cypher, {"name": function_name})
            prs = []
            for row in pr_rows:
                prs.append({
                    "pr_number": row[0],
                    "title": row[1],
                    "author": row[2],
                    "ticket": row[3],
                })
            return {
                "function_name": function_name,
                "rules": rules,
                "history": prs,
            }
        except Exception as exc:
            logger.error("Failed to fetch function context: %s", exc)
            return {
                "function_name": function_name,
                "rules": rules,
                "history": [],
            }


_memory_service_instance: Optional[MemoryService] = None


def get_memory_service() -> MemoryService:
    """Retrieve or initialize singleton MemoryService instance."""
    global _memory_service_instance
    if _memory_service_instance is None:
        _memory_service_instance = MemoryService()
    return _memory_service_instance
