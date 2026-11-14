"""Investigator module: rebuilds case evidence and case subgraph."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import networkx as nx
import polars as pl

from traceflow.config import Config
from traceflow.detectors import Cluster
from traceflow.graph_builder import build_case_graph

logger = logging.getLogger(__name__)


def build_evidence(cluster: Cluster, tx_df: pl.DataFrame, config: Config) -> dict[str, Any]:
    """Rebuild full money trail and evidence object for a cluster."""
    edge_set = set(cluster.edge_ids)
    c_edges = tx_df.filter(pl.col("tx_id").is_in(edge_set)).sort("ts")

    edges_data = []
    accounts_in_edges = set()

    for row in c_edges.iter_rows(named=True):
        src = row["src"]
        dst = row["dst"]
        accounts_in_edges.add(src)
        accounts_in_edges.add(dst)
        dt_str = datetime.fromtimestamp(row["ts"], tz=timezone.utc).isoformat()
        edges_data.append({
            "edge_id": row["tx_id"],
            "src": src,
            "dst": dst,
            "amount": float(row["amount"]),
            "currency": row["currency"],
            "ts": dt_str,
            "timestamp_unix": float(row["ts"]),
        })

    accounts = list(accounts_in_edges)[: config.CLUSTER_SIZE_CAP]

    # Reconstruct small NetworkX graph
    nx_graph = build_case_graph(accounts, edges_data, tx_df)

    # Calculate dwell and retention if not already present
    dwell = cluster.dwell or {}
    retention = cluster.retention or {}

    # Format window times
    w_start = (
        datetime.fromtimestamp(cluster.start_time, tz=timezone.utc).isoformat()
        if cluster.start_time
        else ""
    )
    w_end = (
        datetime.fromtimestamp(cluster.end_time, tz=timezone.utc).isoformat()
        if cluster.end_time
        else ""
    )

    evidence = {
        "cluster_id": cluster.cluster_id,
        "typology": cluster.typology,
        "primary_typology": cluster.primary_typology,
        "risk_score": float(cluster.risk_score) if cluster.risk_score is not None else 0.5,
        "window_start": w_start,
        "window_end": w_end,
        "accounts": accounts,
        "dwell": dwell,
        "retention": retention,
        "end_to_end_retention": cluster.end_to_end_retention,
        "edges": edges_data,
        "chain_hops": cluster.chain_hops or (len(accounts) - 1),
    }

    # Save to disk
    out_dir = Path(config.RESULTS_DIR) / "evidence"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{cluster.cluster_id}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(evidence, f, indent=2)

    return evidence
