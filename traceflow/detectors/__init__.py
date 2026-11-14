"""Detector package for TraceFlow: Cluster dataclass and aggregation."""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field

import polars as pl

from traceflow.config import Config

logger = logging.getLogger(__name__)


@dataclass
class Cluster:
    cluster_id: str
    typology: list[str]
    primary_typology: str
    accounts: list[str]
    edge_ids: list[str]
    start_time: float          # Unix timestamp
    end_time: float            # Unix timestamp
    duration_hours: float
    size: int
    risk_score: float | None = None
    label: int | None = None
    dwell: dict | None = None          # node_id -> seconds
    retention: dict | None = None      # node_id -> ratio or NaN
    end_to_end_retention: float | None = None
    chain_hops: int | None = None


def _account_set_key(accounts: list[str]) -> frozenset:
    return frozenset(accounts)


def _merge_clusters(clusters: list[Cluster], window_hours: float) -> list[Cluster]:
    """Merge clusters whose account sets overlap and time windows overlap.

    Two clusters are merged when they share at least one account AND their time
    windows overlap within window_hours.  The merged cluster inherits the union
    of typologies, accounts, and edge_ids.
    """
    window_seconds = window_hours * 3600.0
    merged: list[Cluster] = []
    used = [False] * len(clusters)

    for i, ci in enumerate(clusters):
        if used[i]:
            continue
        base = ci
        base_accounts = set(ci.accounts)
        base_edges = set(ci.edge_ids)
        base_typologies = set(ci.typology)
        base_start = ci.start_time
        base_end = ci.end_time

        for j, cj in enumerate(clusters):
            if i == j or used[j]:
                continue
            # Check account overlap
            if not base_accounts.intersection(cj.accounts):
                continue
            # Check time-window overlap
            if cj.start_time > base_end + window_seconds:
                continue
            if cj.end_time < base_start - window_seconds:
                continue
            # Merge
            used[j] = True
            base_accounts.update(cj.accounts)
            base_edges.update(cj.edge_ids)
            base_typologies.update(cj.typology)
            base_start = min(base_start, cj.start_time)
            base_end = max(base_end, cj.end_time)

        used[i] = True
        merged_accounts = list(base_accounts)
        merged_typologies = list(base_typologies)
        duration_h = (base_end - base_start) / 3600.0
        merged.append(
            Cluster(
                cluster_id=base.cluster_id,
                typology=merged_typologies,
                primary_typology=base.primary_typology,
                accounts=merged_accounts,
                edge_ids=list(base_edges),
                start_time=base_start,
                end_time=base_end,
                duration_hours=duration_h,
                size=len(merged_accounts),
                risk_score=base.risk_score,
                label=base.label,
                dwell=base.dwell,
                retention=base.retention,
                end_to_end_retention=base.end_to_end_retention,
                chain_hops=base.chain_hops,
            )
        )
    return merged


def _assign_labels(clusters: list[Cluster], tx_df: pl.DataFrame, threshold: float) -> list[Cluster]:
    """Label each cluster 1 (suspicious) if fraction of illicit edges >= threshold."""
    label_map: dict[str, int] = dict(
        zip(tx_df["tx_id"].to_list(), tx_df["label"].to_list())
    )
    for c in clusters:
        if not c.edge_ids:
            c.label = 0
            continue
        illicit = sum(label_map.get(eid, 0) for eid in c.edge_ids)
        c.label = 1 if (illicit / len(c.edge_ids)) >= threshold else 0
    return clusters


def run_all_detectors(tx_df: pl.DataFrame, config: Config) -> list[Cluster]:
    """Run all three detectors, merge overlapping clusters, assign labels."""
    from traceflow.detectors.fan_in_out import fan_in_out
    from traceflow.detectors.cycle import cycle
    from traceflow.detectors.pass_through import pass_through

    logger.info("Running fan_in_out detector…")
    fi_clusters = fan_in_out(tx_df, config)
    logger.info("fan_in_out found %d clusters", len(fi_clusters))

    logger.info("Running cycle detector…")
    cy_clusters = cycle(tx_df, config)
    logger.info("cycle found %d clusters", len(cy_clusters))

    logger.info("Running pass_through detector…")
    pt_clusters = pass_through(tx_df, config)
    logger.info("pass_through found %d clusters", len(pt_clusters))

    all_clusters = fi_clusters + cy_clusters + pt_clusters

    if "token_id" in tx_df.columns and tx_df.filter(pl.col("token_id").is_not_null()).height > 0:
        from traceflow.detectors.wash_trading import detect_wash_trading
        logger.info("Running wash_trading detector…")
        wt_clusters = detect_wash_trading(tx_df, window_hours=config.TIME_WINDOW_HOURS)
        logger.info("wash_trading found %d clusters", len(wt_clusters))
        all_clusters.extend(wt_clusters)

    logger.info("Merging %d total clusters…", len(all_clusters))
    merged = _merge_clusters(all_clusters, config.TIME_WINDOW_HOURS)

    # Cap cluster size
    for c in merged:
        c.accounts = c.accounts[: config.CLUSTER_SIZE_CAP]
        c.size = len(c.accounts)

    # Assign labels
    merged = _assign_labels(merged, tx_df, config.CLUSTER_LABEL_ILLICIT_THRESHOLD)

    logger.info("After merging: %d clusters", len(merged))
    return merged
