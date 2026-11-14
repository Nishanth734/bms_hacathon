"""
Strongly Connected Components (SCC) analysis for wallet graphs.
Finds subgraphs where every wallet is reachable from every other wallet.
"""
from typing import List, Dict, Set
import networkx as nx
import polars as pl

def compute_scc_clusters(df: pl.DataFrame) -> List[Dict]:
    """
    Computes Strongly Connected Components from a standardized transaction dataframe.
    Returns list of dicts:
    [{ 'scc_id': int, 'wallets': list[str], 'size': int, 'is_cycle': bool, 'edge_count': int }]
    """
    G = nx.DiGraph()

    for row in df.iter_rows(named=True):
        src = str(row["src"])
        dst = str(row["dst"])
        G.add_edge(src, dst)

    sccs = list(nx.strongly_connected_components(G))
    # Filter for non-trivial components (size >= 2)
    non_trivial_sccs = [scc for scc in sccs if len(scc) >= 2]

    results = []
    for idx, scc in enumerate(non_trivial_sccs):
        sub = G.subgraph(scc)
        results.append({
            "scc_id": idx + 1,
            "wallets": list(scc),
            "size": len(scc),
            "edge_count": sub.number_of_edges(),
            "density": nx.density(sub),
        })

    return results

def get_wallet_scc_map(df: pl.DataFrame) -> Dict[str, int]:
    """Returns mapping of wallet address to scc_id (or 0 if not in non-trivial SCC)."""
    sccs = compute_scc_clusters(df)
    mapping = {}
    for scc in sccs:
        for w in scc["wallets"]:
            mapping[w] = scc["scc_id"]
    return mapping
