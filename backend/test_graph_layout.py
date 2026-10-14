"""Unit and Integration Tests for Gravity UI Graph Layout Service."""

import pprint
from services.graph_layout import format_gravity_graph
from services.falkor_client import get_falkor_service


def test_synthetic_lanes():
    print("--- Testing Synthetic Nodes across 4 Lanes ---")
    test_nodes = [
        {"id": "f1", "type": "file", "path": "src/auth.ts"},
        {"id": "f2", "type": "file", "path": "src/billing.ts"},
        {"id": "fn1", "type": "function", "name": "validateToken", "file": "src/auth.ts", "blast_level": 0},
        {"id": "fn2", "type": "blast_radius", "name": "processInvoice", "file": "src/billing.ts", "blast_level": 1},
        {"id": "m1", "type": "memory", "rule": "Must check exp claims", "file": ""},
        {"id": "pr1", "type": "company_pr", "title": "PR #104", "author": "@alex.chen"},
    ]
    test_edges = [
        {"source": "f1", "target": "fn1", "label": "DEFINES"},
        {"source": "fn2", "target": "fn1", "label": "CALLS"},
        {"source": "m1", "target": "fn1", "label": "CONSTRAINED_BY"},
        {"source": "pr1", "target": "fn1", "label": "AUTHORED_BY"},
    ]

    res = format_gravity_graph(test_nodes, test_edges)
    blocks = res["blocks"]
    conns = res["connections"]

    assert len(blocks) == 6, f"Expected 6 blocks, got {len(blocks)}"
    assert len(conns) == 4, f"Expected 4 connections, got {len(conns)}"

    # Lane 0: files (x=50)
    b_f1 = next(b for b in blocks if b["id"] == "f1")
    b_f2 = next(b for b in blocks if b["id"] == "f2")
    assert b_f1["x"] == 50 and b_f1["y"] == 50, f"f1 wrong coords: {b_f1['x']}, {b_f1['y']}"
    assert b_f2["x"] == 50 and b_f2["y"] == 190, f"f2 wrong coords: {b_f2['x']}, {b_f2['y']}"
    assert b_f1["width"] == 240 and b_f1["height"] == 110
    assert b_f1["anchors"] == [
        {"id": "f1_in", "type": "IN", "index": 0},
        {"id": "f1_out", "type": "OUT", "index": 0},
    ]

    # Lane 1: core functions (blast_level=0, x=350)
    b_fn1 = next(b for b in blocks if b["id"] == "fn1")
    assert b_fn1["x"] == 350 and b_fn1["y"] == 50
    assert b_fn1["type"] == "function"
    assert b_fn1["data"]["blast_level"] == 0

    # Lane 2: blast radius callers (blast_level>=1, x=680)
    b_fn2 = next(b for b in blocks if b["id"] == "fn2")
    assert b_fn2["x"] == 680 and b_fn2["y"] == 50
    assert b_fn2["type"] == "blast_radius"
    assert b_fn2["data"]["blast_level"] == 1

    # Lane 3: memory guardrails and PR nodes (x=1000)
    b_m1 = next(b for b in blocks if b["id"] == "m1")
    b_pr1 = next(b for b in blocks if b["id"] == "pr1")
    assert b_m1["x"] == 1000 and b_m1["y"] == 50
    assert b_m1["type"] == "memory"
    assert b_m1["data"]["memory_rule"] == "Must check exp claims"
    assert b_pr1["x"] == 1000 and b_pr1["y"] == 190
    assert b_pr1["type"] == "company_pr"
    assert b_pr1["data"]["pr_owner"] == "@alex.chen"

    # Verify connections
    c0 = conns[0]
    assert c0["id"] == "conn_f1_fn1"
    assert c0["sourceBlockId"] == "f1"
    assert c0["sourceAnchorId"] == "f1_out"
    assert c0["targetBlockId"] == "fn1"
    assert c0["targetAnchorId"] == "fn1_in"
    assert c0["label"] == "DEFINES"

    print("✔ All synthetic assertions passed!")


def test_falkordb_live():
    print("\n--- Testing Live FalkorDB Graph Ingestion ---")
    falkor = get_falkor_service()
    if not falkor.is_healthy():
        print("⚠ FalkorDB not reachable, skipping live DB test.")
        return

    nodes = [r[0] for r in falkor.query("MATCH (n) RETURN n")]
    rels = [r[0] for r in falkor.query("MATCH ()-[r]->() RETURN r")]

    res = format_gravity_graph(nodes, rels)
    print(f"✔ Live Graph formatted: {len(res['blocks'])} blocks, {len(res['connections'])} connections.")
    assert len(res["blocks"]) > 0
    assert len(res["connections"]) > 0


if __name__ == "__main__":
    test_synthetic_lanes()
    test_falkordb_live()
