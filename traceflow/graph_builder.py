"""Graph builder for TraceFlow AML pipeline."""
from __future__ import annotations

import logging
from collections import defaultdict

import networkx as nx
import numpy as np
import polars as pl

logger = logging.getLogger(__name__)


def build_edge_arrays(df: pl.DataFrame) -> dict:
    """Build numpy edge arrays and per-account indices from a transaction DataFrame.

    Returns
    -------
    dict with keys:
        ts              : np.ndarray[float64]  - Unix seconds per edge
        src_idx         : np.ndarray[int64]    - source node indices
        dst_idx         : np.ndarray[int64]    - destination node indices
        amount          : np.ndarray[float64]  - edge amounts
        tx_id           : list[str]            - transaction IDs
        node_to_idx     : dict[str, int]       - node label -> index
        idx_to_node     : list[str]            - index -> node label
        account_out_index : dict[int, list[int]] - src_idx -> sorted edge indices
        account_in_index  : dict[int, list[int]] - dst_idx -> sorted edge indices
    """
    # Collect all unique node labels in one pass
    srcs = df["src"].to_list()
    dsts = df["dst"].to_list()

    node_to_idx: dict[str, int] = {}
    idx_to_node: list[str] = []

    for node in srcs + dsts:
        if node not in node_to_idx:
            node_to_idx[node] = len(idx_to_node)
            idx_to_node.append(node)

    n_edges = len(df)
    ts_arr = df["ts"].cast(pl.Float64).to_numpy().copy()
    amount_arr = df["amount"].cast(pl.Float64).to_numpy().copy()
    tx_ids = df["tx_id"].to_list()

    src_idx = np.array([node_to_idx[s] for s in srcs], dtype=np.int64)
    dst_idx = np.array([node_to_idx[d] for d in dsts], dtype=np.int64)

    # Sort edges by ts (they should already be sorted, but ensure it)
    order = np.argsort(ts_arr, kind="stable")
    ts_arr = ts_arr[order]
    amount_arr = amount_arr[order]
    src_idx = src_idx[order]
    dst_idx = dst_idx[order]
    tx_ids = [tx_ids[i] for i in order]

    # Build per-account indices (already sorted by ts because edges are sorted)
    account_out_index: dict[int, list[int]] = defaultdict(list)
    account_in_index: dict[int, list[int]] = defaultdict(list)

    for edge_i in range(n_edges):
        account_out_index[int(src_idx[edge_i])].append(edge_i)
        account_in_index[int(dst_idx[edge_i])].append(edge_i)

    return {
        "ts": ts_arr,
        "src_idx": src_idx,
        "dst_idx": dst_idx,
        "amount": amount_arr,
        "tx_id": tx_ids,
        "node_to_idx": node_to_idx,
        "idx_to_node": idx_to_node,
        "account_out_index": dict(account_out_index),
        "account_in_index": dict(account_in_index),
    }


def build_case_graph(
    cluster_accounts: list[str],
    cluster_edges: list[str],
    tx_df: pl.DataFrame,
) -> nx.DiGraph:
    """Build a NetworkX DiGraph for one case subgraph (at most 30 nodes).

    Parameters
    ----------
    cluster_accounts : list of account IDs to include as nodes
    cluster_edges    : list of tx_ids to include as edges
    tx_df            : full transaction DataFrame
    """
    accounts_set = set(cluster_accounts[:30])
    if cluster_edges and isinstance(cluster_edges[0], dict):
        edge_ids = [e.get("edge_id") or e.get("id") or e.get("tx_id") for e in cluster_edges]
    else:
        edge_ids = cluster_edges
    edges_set = set(edge_ids)

    sub = tx_df.filter(pl.col("tx_id").is_in(edges_set))

    G = nx.DiGraph()
    G.add_nodes_from(list(accounts_set))

    for row in sub.iter_rows(named=True):
        if row["src"] in accounts_set and row["dst"] in accounts_set:
            G.add_edge(
                row["src"],
                row["dst"],
                tx_id=row["tx_id"],
                ts=row["ts"],
                amount=row["amount"],
                currency=row.get("currency", ""),
            )

    return G


def get_per_account_index(edge_arrays: dict) -> dict:
    """Convenience wrapper returning the per-account index from edge_arrays."""
    return {
        "account_out_index": edge_arrays["account_out_index"],
        "account_in_index": edge_arrays["account_in_index"],
    }
