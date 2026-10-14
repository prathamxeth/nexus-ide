"""API Integration Tests for @gravity-ui/graph endpoints."""

from main import get_graph_data, inspect_graph, get_stratified_graph


def test_gravity_graph_data_endpoint():
    print("--- Testing get_graph_data() ---")
    data = get_graph_data()
    assert "blocks" in data, "Missing 'blocks' key in response"
    assert "connections" in data, "Missing 'connections' key in response"

    blocks = data["blocks"]
    connections = data["connections"]
    print(f"✔ get_graph_data() returned {len(blocks)} blocks and {len(connections)} connections.")

    if blocks:
        sample_block = blocks[0]
        # Validate required block schema
        assert "id" in sample_block
        assert "title" in sample_block
        assert "type" in sample_block
        assert sample_block["type"] in ["function", "memory", "blast_radius", "company_pr", "file"]
        assert "file" in sample_block
        assert "x" in sample_block
        assert sample_block["x"] in [50, 350, 680, 1000]
        assert "y" in sample_block
        assert sample_block["width"] == 240
        assert sample_block["height"] == 110
        assert "anchors" in sample_block
        assert len(sample_block["anchors"]) == 2
        assert sample_block["anchors"][0]["type"] == "IN"
        assert sample_block["anchors"][1]["type"] == "OUT"
        assert "data" in sample_block
        assert "signature" in sample_block["data"]
        assert "blast_level" in sample_block["data"]
        assert "memory_rule" in sample_block["data"]
        assert "pr_owner" in sample_block["data"]
        print("✔ Block schema validated successfully.")

    if connections:
        sample_conn = connections[0]
        assert "id" in sample_conn
        assert "sourceBlockId" in sample_conn
        assert "sourceAnchorId" in sample_conn
        assert sample_conn["sourceAnchorId"].endswith("_out")
        assert "targetBlockId" in sample_conn
        assert "targetAnchorId" in sample_conn
        assert sample_conn["targetAnchorId"].endswith("_in")
        assert "label" in sample_conn
        print("✔ Connection schema validated successfully.")


def test_gravity_graph_data_with_function_focus():
    print("\n--- Testing get_graph_data(function_name='validateToken') ---")
    data = get_graph_data(function_name="validateToken")
    blocks = data["blocks"]

    # Verify that callers of validateToken got placed in Lane 2 (x=680) as blast_radius
    blast_blocks = [b for b in blocks if b["type"] == "blast_radius"]
    print(f"✔ Blast radius blocks found: {len(blast_blocks)} (all in Lane 2 at x=680)")
    for b in blast_blocks:
        assert b["x"] == 680
        assert b["data"]["blast_level"] >= 1


def test_inspect_graph_gravity_support():
    print("\n--- Testing inspect_graph() @gravity-ui/graph fields ---")
    res = inspect_graph()
    assert hasattr(res, "blocks") and res.blocks is not None
    assert hasattr(res, "connections") and res.connections is not None
    print(f"✔ inspect_graph returned {len(res.blocks)} blocks and {len(res.connections)} connections.")


def test_stratified_with_gravity_format():
    print("\n--- Testing get_stratified_graph(format='gravity') ---")
    data = get_stratified_graph(function_name="validateToken", format="gravity")
    assert "blocks" in data and "connections" in data
    print(f"✔ Stratified gravity format returned {len(data['blocks'])} blocks and {len(data['connections'])} connections.")


if __name__ == "__main__":
    test_gravity_graph_data_endpoint()
    test_gravity_graph_data_with_function_focus()
    test_inspect_graph_gravity_support()
    test_stratified_with_gravity_format()
    print("\n🎉 ALL API ENDPOINT TESTS PASSED SUCCESSFULLY!")
