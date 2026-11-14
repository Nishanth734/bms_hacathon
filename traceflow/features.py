"""Cluster feature extraction for ranking and ablation."""
from __future__ import annotations

import math
from collections import Counter
from typing import Any

import numpy as np
import polars as pl

from traceflow.detectors import Cluster


def build_feature_row(cluster: Cluster, tx_df: pl.DataFrame) -> dict[str, Any]:
    """Build a dictionary of features for one candidate cluster."""
    # Filter tx_df for cluster edges if present
    edge_set = set(cluster.edge_ids)
    c_edges = tx_df.filter(pl.col("tx_id").is_in(edge_set))

    edge_count = len(cluster.edge_ids)

    if not c_edges.is_empty():
        amounts = c_edges["amount"].to_numpy()
        amount_total = float(np.sum(amounts))
        amount_mean = float(np.mean(amounts))
        amount_std = float(np.std(amounts)) if len(amounts) > 1 else 0.0

        srcs = c_edges["src"].to_list()
        dsts = c_edges["dst"].to_list()
        in_counts = Counter(dsts)
        out_counts = Counter(srcs)
        max_in_deg = float(max(in_counts.values())) if in_counts else 0.0
        max_out_deg = float(max(out_counts.values())) if out_counts else 0.0
    else:
        amount_total = 0.0
        amount_mean = 0.0
        amount_std = 0.0
        max_in_deg = 0.0
        max_out_deg = 0.0

    # Typologies
    typs = set(cluster.typology)
    is_fan_out = 1 if "fan_out" in typs else 0
    is_fan_in = 1 if "fan_in" in typs else 0
    is_cycle = 1 if "cycle" in typs else 0
    is_pass_through = 1 if "pass_through" in typs else 0

    fan_out_count = float(is_fan_out)
    cycle_count = float(is_cycle)
    pass_through_count = float(is_pass_through)

    # Dwell features
    if cluster.dwell:
        dwell_vals = [d for d in cluster.dwell.values() if d is not None and not math.isnan(d)]
        mean_dwell = float(np.mean(dwell_vals)) if dwell_vals else float("nan")
    else:
        mean_dwell = float("nan")

    # Retention features
    if cluster.retention:
        ret_vals = [r for r in cluster.retention.values() if r is not None and not math.isnan(r)]
        mean_ret = float(np.mean(ret_vals)) if ret_vals else float("nan")
    else:
        mean_ret = float("nan")

    e2e_ret = cluster.end_to_end_retention if cluster.end_to_end_retention is not None else float("nan")

    row = {
        "cluster_id": cluster.cluster_id,
        "size": float(cluster.size),
        "duration_hours": float(cluster.duration_hours),
        "edge_count": float(edge_count),
        "amount_total": amount_total,
        "amount_mean": amount_mean,
        "amount_std": amount_std,
        "max_in_degree": max_in_deg,
        "max_out_degree": max_out_deg,
        "fan_out_count": fan_out_count,
        "cycle_count": cycle_count,
        "pass_through_count": pass_through_count,
        "mean_dwell_seconds": mean_dwell,
        "mean_retention": mean_ret,
        "end_to_end_retention": e2e_ret,
        "is_fan_out": is_fan_out,
        "is_fan_in": is_fan_in,
        "is_cycle": is_cycle,
        "is_pass_through": is_pass_through,
        "label": int(cluster.label if cluster.label is not None else 0),
    }

    return row


def build_feature_table(clusters: list[Cluster], tx_df: pl.DataFrame) -> pl.DataFrame:
    """Build a feature DataFrame from a list of clusters."""
    if not clusters:
        return pl.DataFrame()

    rows = [build_feature_row(c, tx_df) for c in clusters]
    return pl.DataFrame(rows)
