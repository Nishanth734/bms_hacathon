"""Tests for traceflow.graph_builder."""
import networkx as nx
from traceflow.graph_builder import build_edge_arrays, build_case_graph

def test_edge_arrays_completeness(tiny_df):
    arrays = build_edge_arrays(tiny_df)
    for key in ["ts", "src_idx", "dst_idx", "amount", "tx_id", "node_to_idx", "idx_to_node", "account_out_index", "account_in_index"]:
        assert key in arrays
    assert len(arrays["ts"]) == len(tiny_df)

def test_node_index_mapping(tiny_df):
    arrays = build_edge_arrays(tiny_df)
    n2i = arrays["node_to_idx"]
    i2n = arrays["idx_to_node"]
    for node, idx in n2i.items():
        assert i2n[idx] == node

def test_account_out_index_sorted(tiny_df):
    arrays = build_edge_arrays(tiny_df)
    ts = arrays["ts"]
    for src_idx, edge_indices in arrays["account_out_index"].items():
        edge_ts = [ts[e] for e in edge_indices]
        assert edge_ts == sorted(edge_ts)

def test_case_graph_max_nodes(tiny_df, sample_cluster):
    edges = [{"edge_id": "0", "src": "B1_A", "dst": "B2_B", "amount": 100.0, "currency": "USD"}]
    G = build_case_graph(sample_cluster.accounts, edges, tiny_df)
    assert isinstance(G, nx.DiGraph)
    assert len(G.nodes) <= 30
