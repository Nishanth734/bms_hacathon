"""Fan-in / fan-out typology detector."""
from __future__ import annotations

import logging
import uuid
from collections import defaultdict

import polars as pl

from traceflow.config import Config
from traceflow.detectors import Cluster

logger = logging.getLogger(__name__)


def fan_in_out(tx_df: pl.DataFrame, config: Config) -> list[Cluster]:
    """Detect fan-in and fan-out patterns using a sliding time window.

    For each account, within any TIME_WINDOW_HOURS sliding window:
    - fan_in  : >= FAN_IN_OUT_MIN_COUNTERPARTIES distinct incoming source accounts
    - fan_out : >= FAN_IN_OUT_MIN_COUNTERPARTIES distinct outgoing destination accounts

    Returns a list of Cluster objects.
    """
    window_s = config.TIME_WINDOW_HOURS * 3600.0
    min_cp = config.FAN_IN_OUT_MIN_COUNTERPARTIES
    cap = config.CLUSTER_SIZE_CAP

    clusters: list[Cluster] = []

    # ---- Fan-in: group by dst ----
    dst_groups = (
        tx_df.select(["dst", "ts", "src", "tx_id", "amount"])
        .sort("ts")
        .group_by("dst")
    )

    for dst_key, group_df in dst_groups:
        center = dst_key[0] if isinstance(dst_key, tuple) else dst_key
        rows = group_df.sort("ts")
        ts_list = rows["ts"].to_list()
        src_list = rows["src"].to_list()
        tid_list = rows["tx_id"].to_list()
        n = len(ts_list)

        left = 0
        for right in range(n):
            # Advance left pointer so window stays within window_s
            while ts_list[right] - ts_list[left] > window_s:
                left += 1
            window_srcs = src_list[left : right + 1]
            distinct_srcs = set(window_srcs)
            if len(distinct_srcs) >= min_cp:
                window_tids = tid_list[left : right + 1]
                accounts = [center] + list(distinct_srcs)[:cap - 1]
                c = Cluster(
                    cluster_id=str(uuid.uuid4()),
                    typology=["fan_in"],
                    primary_typology="fan_in",
                    accounts=accounts,
                    edge_ids=window_tids,
                    start_time=ts_list[left],
                    end_time=ts_list[right],
                    duration_hours=(ts_list[right] - ts_list[left]) / 3600.0,
                    size=len(accounts),
                )
                clusters.append(c)
                # Advance left by one to slide window and avoid duplicate clusters
                # for every new right we don't re-emit if already emitted for this window
                break

    # ---- Fan-out: group by src ----
    src_groups = (
        tx_df.select(["src", "ts", "dst", "tx_id", "amount"])
        .sort("ts")
        .group_by("src")
    )

    for src_key, group_df in src_groups:
        center = src_key[0] if isinstance(src_key, tuple) else src_key
        rows = group_df.sort("ts")
        ts_list = rows["ts"].to_list()
        dst_list = rows["dst"].to_list()
        tid_list = rows["tx_id"].to_list()
        n = len(ts_list)

        left = 0
        for right in range(n):
            while ts_list[right] - ts_list[left] > window_s:
                left += 1
            window_dsts = dst_list[left : right + 1]
            distinct_dsts = set(window_dsts)
            if len(distinct_dsts) >= min_cp:
                window_tids = tid_list[left : right + 1]
                accounts = [center] + list(distinct_dsts)[:cap - 1]
                c = Cluster(
                    cluster_id=str(uuid.uuid4()),
                    typology=["fan_out"],
                    primary_typology="fan_out",
                    accounts=accounts,
                    edge_ids=window_tids,
                    start_time=ts_list[left],
                    end_time=ts_list[right],
                    duration_hours=(ts_list[right] - ts_list[left]) / 3600.0,
                    size=len(accounts),
                )
                clusters.append(c)
                break

    return clusters
