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
    ) -> None:
        self.host = host or os.getenv("FALKORDB_HOST", "localhost")
        self.port = port or int(os.getenv("FALKORDB_PORT", "6379"))
        self.graph_name = graph_name or os.getenv("FALKORDB_GRAPH", "nexus_code_graph")
        self._db: Optional[FalkorDB] = None
        self._graph = None

    def connect(self) -> None:
        """Establish connection to FalkorDB and select primary graph."""
        try:
            self._db = FalkorDB(host=self.host, port=self.port)
            self._graph = self._db.select_graph(self.graph_name)
            logger.info(
                "Connected to FalkorDB at %s:%s [Graph: %s]",
                self.host,
                self.port,
                self.graph_name,
            )
        except Exception as exc:
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
                return True
            return False
        except Exception as exc:
            logger.warning("FalkorDB ping failed: %s", exc)
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
        }

    def query(self, cypher: str, params: Optional[Dict[str, Any]] = None) -> List[Any]:
        """Execute a Cypher query against the active graph."""
        try:
            result = self.graph.query(cypher, params or {})
            return result.result_set if hasattr(result, "result_set") else result
        except Exception as exc:
            logger.error("Error executing Cypher query [%s]: %s", cypher, exc)
            raise

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
