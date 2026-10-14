"""Gravity UI Graph Layout Service for FalkorDB Knowledge Graph.

Transforms raw FalkorDB nodes and relationships into the block-and-connection
schema required by @gravity-ui/graph, arranged in 4 distinct vertical swimlanes.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger("nexus.services.graph_layout")

# Swimlane geometry configuration
LANE_X: Dict[int, int] = {
    0: 50,    # Lane 0: File nodes and imports
    1: 350,   # Lane 1: Core functions (blast_level == 0)
    2: 680,   # Lane 2: Blast radius callers (blast_level >= 1)
    3: 1000,  # Lane 3: Memory guardrails and PR nodes
}

BLOCK_WIDTH: int = 240
BLOCK_HEIGHT: int = 110
VERTICAL_SPACING: int = 140
INITIAL_Y: int = 50

# Valid Gravity UI Block Types
CANONICAL_TYPES: Set[str] = {
    "function",
    "memory",
    "blast_radius",
    "company_pr",
    "file",
}


def _extract_node_info(node: Any) -> Tuple[str, List[str], Dict[str, Any]]:
    """Extract raw_id, labels, and properties dictionary from arbitrary node object."""
    if isinstance(node, dict):
        raw_id = str(node.get("id") or node.get("name") or node.get("path") or "")
        labels = node.get("labels") or []
        if isinstance(labels, str):
            labels = [labels]
        elif not isinstance(labels, list):
            labels = list(labels)
        if not labels and node.get("type"):
            labels = [str(node["type"])]
        props = dict(node.get("properties") or node.get("data") or node.get("metadata") or node)
        return raw_id, labels, props

    raw_id = str(getattr(node, "id", ""))
    labels = list(getattr(node, "labels", []))
    props = dict(getattr(node, "properties", {}))
    return raw_id, labels, props


def _classify_node(
    raw_id: str,
    labels: List[str],
    props: Dict[str, Any],
    node_obj: Any,
) -> Tuple[str, int, int]:
    """Classify node into canonical block type, lane index (0-3), and blast_level.

    Returns:
        (block_type, lane, blast_level)
    """
    blast_val = (
        props.get("blast_level")
        if props.get("blast_level") is not None
        else props.get("depth", props.get("hop", 0))
    )
    try:
        blast_level = int(blast_val)
    except (ValueError, TypeError):
        blast_level = 0

    explicit_type = str(
        props.get("type")
        or (node_obj.get("type") if isinstance(node_obj, dict) else "")
        or ""
    ).lower().strip()

    labels_lower = [str(l).lower().strip() for l in labels]

    # Explicit canonical type override
    if explicit_type == "blast_radius" or (explicit_type == "function" and blast_level >= 1):
        return "blast_radius", 2, max(blast_level, 1)
    if explicit_type == "function":
        return "function", 1, 0
    if explicit_type == "file":
        return "file", 0, 0
    if explicit_type == "memory":
        return "memory", 3, 0
    if explicit_type == "company_pr":
        return "company_pr", 3, 0

    # Rule 1: Lane 0 (x=50) - File nodes and imports
    if (
        any(l in ("file", "import", "module") for l in labels_lower)
        or explicit_type in ("file", "import", "module")
        or ("lines" in props and "path" in props)
    ):
        return "file", 0, 0

    # Rule 2: Lane 3 (x=1000) - Memory guardrails and PR nodes
    if (
        any(l in ("memory", "proceduralrule", "action", "rule", "guardrail") for l in labels_lower)
        or explicit_type in ("memory", "rule", "guardrail")
        or "rule" in props
        or "error_context" in props
    ):
        return "memory", 3, 0

    if (
        any(l in ("pr", "ticket", "engineer", "session", "author", "commit") for l in labels_lower)
        or explicit_type in ("company_pr", "company", "pr", "ticket", "engineer")
        or any(k in props for k in ("pr_number", "ticket_key", "handle"))
    ):
        return "company_pr", 3, 0

    # Rule 3 & 4: Functions & Callers (Lanes 1 and 2)
    is_fn_like = (
        any(l in ("function", "method", "class") for l in labels_lower)
        or "name" in props
        or "signature" in props
    )

    if is_fn_like:
        if blast_level >= 1 or props.get("is_blast"):
            return "blast_radius", 2, max(blast_level, 1)
        return "function", 1, 0

    # Fallback heuristic
    if blast_level >= 1:
        return "blast_radius", 2, blast_level
    if "path" in props and ("." in str(props.get("path", "")) or "/" in str(props.get("path", "")) or "\\" in str(props.get("path", ""))):
        return "file", 0, 0
    if "name" in props:
        return "function", 1, 0

    return "function", 1, 0


def format_gravity_graph(
    nodes: Optional[Any] = None,
    relationships: Optional[Any] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """Format FalkorDB nodes and relationships into @gravity-ui/graph format.

    Args:
        nodes: List of FalkorDB Node instances or node dictionaries.
        relationships: List of FalkorDB Edge instances, relationship dicts, or tuples.

    Returns:
        dict: {
            "blocks": List[Dict[str, Any]],
            "connections": List[Dict[str, Any]]
        }
    """
    # Normalize input arguments
    if isinstance(nodes, dict):
        # Support passing a combined graph dict e.g. {"nodes": [...], "relationships": [...]}
        input_dict = nodes
        relationships = (
            relationships
            or input_dict.get("relationships")
            or input_dict.get("edges")
            or input_dict.get("connections")
        )
        nodes = input_dict.get("nodes") or input_dict.get("blocks")

    # Support raw query results where each row is [source_node, rel, target_node]
    if (
        relationships is None
        and isinstance(nodes, list)
        and len(nodes) > 0
        and isinstance(nodes[0], (list, tuple))
        and len(nodes[0]) >= 3
    ):
        extracted_nodes: List[Any] = []
        extracted_rels: List[Any] = []
        for row in nodes:
            extracted_nodes.append(row[0])
            extracted_rels.append(row[1])
            extracted_nodes.append(row[2])
        nodes = extracted_nodes
        relationships = extracted_rels

    nodes_list = list(nodes or [])
    rels_list = list(relationships or [])

    blocks: List[Dict[str, Any]] = []
    seen_block_ids: Set[str] = set()
    id_map: Dict[Any, str] = {}

    # Track independent vertical counters per swimlane
    # Spacing formula: y = lane_index * 140 + 50
    lane_counters: Dict[int, int] = {0: 0, 1: 0, 2: 0, 3: 0}

    for node in nodes_list:
        raw_id, labels, props = _extract_node_info(node)
        block_id = str(props.get("id") or raw_id)
        if not block_id:
            block_id = f"node_{len(seen_block_ids)}"

        if block_id in seen_block_ids:
            # Map alternate identifiers to the canonical block ID
            id_map[raw_id] = block_id
            if hasattr(node, "id"):
                id_map[node.id] = block_id
                id_map[str(node.id)] = block_id
            if "name" in props:
                id_map[props["name"]] = block_id
            if "path" in props:
                id_map[props["path"]] = block_id
            continue

        seen_block_ids.add(block_id)

        # Register mappings for robust relationship edge resolution
        id_map[block_id] = block_id
        id_map[raw_id] = block_id
        if hasattr(node, "id"):
            id_map[node.id] = block_id
            id_map[str(node.id)] = block_id
            id_map[f"node_{node.id}"] = block_id
        if "name" in props:
            id_map[props["name"]] = block_id
        if "path" in props:
            id_map[props["path"]] = block_id
        if "key" in props:
            id_map[props["key"]] = block_id
        if "handle" in props:
            id_map[props["handle"]] = block_id

        # Classify node type, swimlane, and blast level
        block_type, lane, blast_level = _classify_node(raw_id, labels, props, node)

        # Calculate coordinates based on independent vertical counter
        lane_index = lane_counters[lane]
        x = LANE_X[lane]
        y = lane_index * VERTICAL_SPACING + INITIAL_Y
        lane_counters[lane] += 1

        # Determine title
        if props.get("title"):
            title = str(props["title"])
        elif block_type == "file":
            title = str(props.get("path") or props.get("name") or block_id)
        elif block_type in ("function", "blast_radius"):
            title = str(props.get("name") or block_id)
        elif block_type == "memory":
            title = str(props.get("rule") or props.get("error") or props.get("description") or "Memory Rule")
        elif block_type == "company_pr":
            if "id" in props and ("title" in props or "PR" in labels):
                title = f"PR #{props['id']}: {props.get('title', '')}".strip(": ")
            elif "pr_number" in props:
                title = f"PR #{props['pr_number']}: {props.get('pr_title', '')}".strip(": ")
            elif "handle" in props:
                title = str(props["handle"])
            elif "key" in props:
                title = str(props["key"])
            else:
                title = str(props.get("name") or block_id)
        else:
            title = str(props.get("name") or props.get("path") or block_id)

        # Determine file path string
        file_str = str(props.get("file") or props.get("path") or "")

        # Format data payload
        if props.get("signature"):
            sig_str = str(props["signature"])
        elif block_type in ("function", "blast_radius") and props.get("name"):
            sig_str = f"{props['name']}()"
        elif block_type == "file" and file_str:
            sig_str = f"file: {file_str}"
        else:
            sig_str = ""

        # Memory rule
        if block_type == "memory":
            mem_rule_raw = (
                props.get("rule")
                or props.get("memory_rule")
                or props.get("error")
                or props.get("description")
            )
            mem_rule = str(mem_rule_raw) if mem_rule_raw is not None else None
        elif props.get("memory_rule"):
            mem_rule = str(props["memory_rule"])
        elif props.get("rule"):
            mem_rule = str(props["rule"])
        else:
            mem_rule = None

        # PR owner / author
        if block_type == "company_pr":
            owner = (
                props.get("pr_owner")
                or props.get("author")
                or props.get("author_handle")
                or props.get("handle")
            )
            pr_owner = str(owner) if owner is not None else None
        elif props.get("pr_owner"):
            pr_owner = str(props["pr_owner"])
        elif props.get("author") or props.get("author_handle"):
            pr_owner = str(props.get("author") or props.get("author_handle"))
        else:
            pr_owner = None

        block: Dict[str, Any] = {
            "id": block_id,
            "title": title,
            "type": block_type,
            "file": file_str,
            "x": x,
            "y": y,
            "width": BLOCK_WIDTH,
            "height": BLOCK_HEIGHT,
            "anchors": [
                {"id": f"{block_id}_in", "type": "IN", "index": 0},
                {"id": f"{block_id}_out", "type": "OUT", "index": 0},
            ],
            "data": {
                "signature": sig_str,
                "blast_level": blast_level,
                "memory_rule": mem_rule,
                "pr_owner": pr_owner,
            },
        }
        blocks.append(block)

    # Process relationships into connections
    connections: List[Dict[str, Any]] = []
    seen_conn_keys: Dict[str, int] = {}

    for rel in rels_list:
        if hasattr(rel, "src_node") and hasattr(rel, "dest_node"):
            src_val = rel.src_node
            dst_val = rel.dest_node
            edge_type = getattr(rel, "relation", getattr(rel, "type", "CONNECTED_TO"))
        elif isinstance(rel, dict):
            src_val = (
                rel.get("source")
                or rel.get("src")
                or rel.get("sourceBlockId")
                or rel.get("from")
            )
            dst_val = (
                rel.get("target")
                or rel.get("dst")
                or rel.get("targetBlockId")
                or rel.get("to")
            )
            edge_type = (
                rel.get("label")
                or rel.get("type")
                or rel.get("relationship")
                or "CONNECTED_TO"
            )
        elif isinstance(rel, (list, tuple)) and len(rel) >= 3:
            src_val = rel[0]
            edge_type = str(rel[1])
            dst_val = rel[2]
        else:
            continue

        source_id = id_map.get(src_val, str(src_val) if src_val is not None else None)
        target_id = id_map.get(dst_val, str(dst_val) if dst_val is not None else None)

        if not source_id or not target_id:
            continue
        if source_id not in seen_block_ids or target_id not in seen_block_ids:
            continue

        base_id = f"conn_{source_id}_{target_id}"
        if base_id not in seen_conn_keys:
            conn_id = base_id
            seen_conn_keys[base_id] = 1
        else:
            seen_conn_keys[base_id] += 1
            conn_id = f"{base_id}_{seen_conn_keys[base_id]}"

        connection: Dict[str, Any] = {
            "id": conn_id,
            "sourceBlockId": source_id,
            "sourceAnchorId": f"{source_id}_out",
            "targetBlockId": target_id,
            "targetAnchorId": f"{target_id}_in",
            "label": str(edge_type),
        }
        connections.append(connection)

    return {
        "blocks": blocks,
        "connections": connections,
    }
