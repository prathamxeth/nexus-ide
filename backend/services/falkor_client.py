"""FalkorDB Interface Client and Graph Schema Initialization Service.

Manages FalkorDB connection lifecycle, Cypher query execution, schema indexing,
and health diagnostics for the Nexus IDE code intelligence graph.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple
from falkordb import FalkorDB

logger = logging.getLogger("nexus.services.falkor")


class FalkorService:
    """Singleton service managing FalkorDB connection, indices, and Cypher queries."""

    # Schema specifications for sub-millisecond graph traversals
    REQUIRED_INDICES: List[Tuple[str, str]] = [
        ("File", "path"),
        ("Function", "name"),
        ("Function", "file"),
        ("Engineer", "handle"),
        ("Ticket", "key"),
        ("PR", "id"),
        ("Session", "id"),
    ]

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        graph_name: Optional[str] = None,
        password: Optional[str] = None,
        username: Optional[str] = None,
        ssl: Optional[bool] = None,
    ) -> None:
        raw_host = (host or os.getenv("FALKORDB_HOST", "localhost")).strip().replace("\r", "").replace("\n", "")
        if "://" in raw_host:
            raw_host = raw_host.split("://", 1)[1]
        raw_host = raw_host.rstrip("/").split("/", 1)[0].strip()
        parsed_port = None
        if ":" in raw_host:
            host_part, port_str = raw_host.split(":", 1)
            raw_host = host_part.strip()
            try:
                parsed_port = int(port_str.strip())
            except ValueError:
                pass
        self.host = raw_host.strip()
        env_port = (os.getenv("FALKORDB_PORT") or "").strip()
        self.port = port or (int(env_port) if env_port else (parsed_port or 6379))
        self.password = (password or os.getenv("FALKORDB_PASSWORD") or "").strip() or None
        self.username = (username or os.getenv("FALKORDB_USERNAME") or "").strip() or None
        raw_ssl = os.getenv("FALKORDB_SSL")
        if raw_ssl is not None:
            self.ssl = raw_ssl.lower().strip() in ("true", "1", "yes")
        elif ssl is not None:
            self.ssl = ssl
        else:
            self.ssl = ".cloud" in self.host
        self.graph_name = graph_name or os.getenv("FALKORDB_GRAPH", "nexus_code_graph")
        self._db: Optional[FalkorDB] = None
        self._graph = None
        self.last_error: Optional[str] = None

    def connect(self) -> None:
        """Establish connection to FalkorDB and select primary graph."""
        try:
            connect_kwargs: Dict[str, Any] = {
                "host": self.host,
                "port": self.port,
                "socket_connect_timeout": 15.0,
                "socket_timeout": 15.0,
            }
            if self.password:
                connect_kwargs["password"] = self.password
            if self.username:
                connect_kwargs["username"] = self.username
            if self.ssl:
                connect_kwargs["ssl"] = True
                connect_kwargs["ssl_cert_reqs"] = "none"

            self._db = FalkorDB(**connect_kwargs)
            self._graph = self._db.select_graph(self.graph_name)
            logger.info(
                "Connected to FalkorDB at %s:%s (ssl=%s) [Graph: %s]",
                self.host,
                self.port,
                self.ssl,
                self.graph_name,
            )
        except Exception as exc:
            self.last_error = str(exc)
            logger.error("Failed to connect to FalkorDB: %s", exc)
            self._db = None
            self._graph = None
            raise

    @property
    def graph(self):
        """Get the active graph instance, connecting lazily if necessary."""
        if self._graph is None:
            self.connect()
        return self._graph

    def get_existing_indices(self) -> set[Tuple[str, str]]:
        """Retrieve existing (label, property) index tuples from FalkorDB."""
        existing: set[Tuple[str, str]] = set()
        try:
            raw_indices = self.query("CALL db.indexes()")
            for row in raw_indices:
                if len(row) >= 2:
                    label = str(row[0])
                    props = row[1] if isinstance(row[1], (list, tuple)) else [row[1]]
                    for p in props:
                        existing.add((label, str(p)))
        except Exception as exc:
            logger.debug("Could not inspect existing indices via CALL db.indexes(): %s", exc)
        return existing

    def init_schema(self) -> Dict[str, Any]:
        """Enforce required graph indices for high-performance sub-millisecond lookups.

        Enforces:
        - :File(path)
        - :Function(name)
        - :Function(file)
        - :Engineer(handle)
        - :Ticket(key)
        """
        results: Dict[str, str] = {}
        logger.info("Enforcing FalkorDB schema indices on graph '%s'...", self.graph_name)

        existing_indices = self.get_existing_indices()

        for label, prop in self.REQUIRED_INDICES:
            index_key = f":{label}({prop})"
            if (label, prop) in existing_indices:
                results[index_key] = "already_exists"
                logger.debug("Index on %s already exists", index_key)
                continue

            cypher = f"CREATE INDEX FOR (n:{label}) ON (n.{prop})"
            try:
                self.query(cypher)
                results[index_key] = "created"
                logger.info("Successfully created index on %s", index_key)
            except Exception as exc:
                err_msg = str(exc).lower()
                if "already indexed" in err_msg or "already exists" in err_msg:
                    results[index_key] = "already_exists"
                    logger.debug("Index on %s already exists", index_key)
                else:
                    results[index_key] = f"error: {exc}"
                    logger.warning("Failed to create index on %s: %s", index_key, exc)

        return results

    def ping(self) -> bool:
        """Execute 'RETURN 1' healthcheck ensuring Cypher engine is operational."""
        try:
            result = self.query("RETURN 1 AS ping")
            if result and len(result) > 0 and result[0][0] == 1:
                self.last_error = None
                return True
            return False
        except Exception as exc:
            self.last_error = str(exc)
            logger.warning("FalkorDB ping failed: %s", exc)
            self._db = None
            self._graph = None

            # If connecting to cloud and FALKORDB_SSL wasn't explicitly pinned, try opposite SSL mode
            if os.getenv("FALKORDB_SSL") is None and (".cloud" in self.host or self.port != 6379):
                try:
                    self.ssl = not self.ssl
                    logger.info("Retrying FalkorDB ping with SSL=%s", self.ssl)
                    result = self.query("RETURN 1 AS ping")
                    if result and len(result) > 0 and result[0][0] == 1:
                        self.last_error = None
                        return True
                except Exception as retry_exc:
                    self.last_error = str(retry_exc)
                    self._db = None
                    self._graph = None

            return False

    def is_healthy(self) -> bool:
        """Alias for ping() health check."""
        return self.ping()

    def get_node_count(self) -> int:
        """Retrieve total number of active nodes in the primary graph."""
        try:
            res = self.query("MATCH (n) RETURN count(n) AS node_count")
            if res and len(res) > 0:
                return int(res[0][0])
            return 0
        except Exception as exc:
            logger.warning("Failed to retrieve node count from FalkorDB: %s", exc)
            return 0

    def get_health_metrics(self) -> Dict[str, Any]:
        """Measure latency in ms, connectivity, and active node count."""
        start_time = time.perf_counter()
        is_live = self.ping()
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

        node_count = self.get_node_count() if is_live else 0

        return {
            "status": "connected" if is_live else "disconnected",
            "active_nodes_count": node_count,
            "latency_ms": latency_ms if is_live else None,
            "host": self.host,
            "port": self.port,
            "graph": self.graph_name,
            "ssl": self.ssl,
            "has_password": bool(self.password),
            "error": self.last_error if not is_live else None,
        }

    def query(self, cypher: str, params: Optional[Dict[str, Any]] = None) -> List[Any]:
        """Execute a Cypher query against the active graph."""
        try:
            result = self.graph.query(cypher, params or {})
            return result.result_set if hasattr(result, "result_set") else result
        except Exception as exc:
            logger.error("Error executing Cypher query [%s]: %s", cypher, exc)
            raise

    def get_blast_radius(self, function_name: str, max_depth: int = 4) -> Dict[str, Any]:
        """Execute multi-hop Cypher traversal to compute upstream callers and blast radius.

        Finds all functions that directly or transitively call the target function
        up to `max_depth` hops away.
        """
        start_time = time.perf_counter()
        cypher = f"""
        MATCH (target:Function {{name: $name}})
        OPTIONAL MATCH path = (caller:Function)-[:CALLS*1..{max_depth}]->(target)
        WITH target, caller, length(path) AS depth
        WHERE caller IS NOT NULL
        RETURN 
            caller.name AS caller_name,
            caller.file AS caller_file,
            min(depth) AS min_depth
        ORDER BY min_depth ASC
        """
        try:
            results = self.query(cypher, {"name": function_name})
            callers = []
            for row in results:
                if len(row) >= 3 and row[0]:
                    callers.append({
                        "name": str(row[0]),
                        "file": str(row[1]) if row[1] else "",
                        "depth": int(row[2]) if row[2] else 1,
                    })

            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "target_function": function_name,
                "callers": callers,
                "total_callers": len(callers),
                "max_depth": max_depth,
                "latency_ms": latency_ms,
            }
        except Exception as exc:
            logger.warning("Error computing blast radius for '%s': %s", function_name, exc)
            return {
                "target_function": function_name,
                "callers": [],
                "total_callers": 0,
                "max_depth": max_depth,
                "latency_ms": 0.0,
                "error": str(exc),
            }

    def get_episodic_memory(self, function_name: str) -> Dict[str, Any]:
        """Retrieve procedural memory rules and historical failure records for a function."""
        start_time = time.perf_counter()
        cypher = """
        MATCH (fn:Function {name: $name})
        OPTIONAL MATCH (fn)-[:HAS_RULE]->(m:Memory)
        OPTIONAL MATCH (a:Action)-[:FAILED_ON]->(fn)
        RETURN 
            collect(DISTINCT m.rule) AS rules,
            collect(DISTINCT a.error) AS previous_errors
        """
        try:
            results = self.query(cypher, {"name": function_name})
            rules: List[str] = []
            errors: List[str] = []
            if results and len(results) > 0:
                raw_rules = results[0][0] or []
                raw_errors = results[0][1] or []
                rules = [str(r) for r in raw_rules if r]
                errors = [str(e) for e in raw_errors if e]

            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "function_name": function_name,
                "rules": rules,
                "previous_errors": errors,
                "latency_ms": latency_ms,
            }
        except Exception as exc:
            logger.warning("Error retrieving episodic memory for '%s': %s", function_name, exc)
            return {
                "function_name": function_name,
                "rules": [],
                "previous_errors": [],
                "latency_ms": 0.0,
                "error": str(exc),
            }

    def get_refactor_context(self, function_name: str) -> Dict[str, Any]:
        """Unified sub-millisecond graph query gathering blast radius + procedural memory."""
        start_time = time.perf_counter()
        blast_radius = self.get_blast_radius(function_name)
        memory = self.get_episodic_memory(function_name)
        total_latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return {
            "target_function": function_name,
            "blast_radius": blast_radius,
            "memory": memory,
            "total_latency_ms": total_latency_ms,
        }

    def verify_hard_connection(self) -> None:
        """Hard Kill-Switch: Crash immediately if FalkorDB is not connected."""
        try:
            self.query("RETURN 1")
        except Exception as e:
            raise ConnectionError(
                f"[CRITICAL COMPLIANCE FAILURE] FalkorDB required at {self.host}:{self.port}: {e}"
            )

    def calculate_ast_centrality(self) -> Dict[str, float]:
        """Invoke FalkorDB PageRank/Centrality algorithm to score AST criticality.

        Executes native FalkorDB PageRank matrix operation:
        `CALL algo.pageRank('Function', 'CALLS') YIELD node, score`
        Falls back to in-degree centrality graph query if the algo module is not active.
        """
        query = """
        CALL algo.pageRank('Function', 'CALLS')
        YIELD node, score
        RETURN node.name AS func_name, score
        ORDER BY score DESC
        LIMIT 10
        """
        try:
            res = self.query(query)
            if res:
                return {str(row[0]): float(row[1]) for row in res if len(row) >= 2}
        except Exception as exc:
            logger.debug("Native PageRank algo not active, calculating in-degree centrality: %s", exc)

        query_fallback = """
        MATCH (fn:Function)<-[:CALLS]-(caller)
        RETURN fn.name, count(caller) AS degree
        ORDER BY degree DESC
        LIMIT 10
        """
        try:
            res = self.query(query_fallback)
            if res:
                max_deg = max([float(row[1]) for row in res if len(row) >= 2] or [1.0])
                return {str(row[0]): round(float(row[1]) / max_deg, 2) for row in res if len(row) >= 2}
        except Exception as e:
            logger.warning("Failed calculating AST centrality: %s", e)
        return {}

    def close(self) -> None:
        """Close connection resources."""
        self._db = None
        self._graph = None


# Backward-compatible alias
FalkorClient = FalkorService

_falkor_instance: Optional[FalkorService] = None


def get_falkor_service() -> FalkorService:
    """Retrieve or initialize singleton FalkorService instance."""
    global _falkor_instance
    if _falkor_instance is None:
        _falkor_instance = FalkorService()
    return _falkor_instance


# Backward-compatible alias
get_falkor_client = get_falkor_service
