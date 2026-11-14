"""Rapid pass-through (mule) chain detector for TraceFlow.

Finds chains of >= PASS_THROUGH_MIN_HOPS hops where money moves forward in time
and dwells at each intermediate node for <= PASS_THROUGH_MAX_DWELL_HOURS.
"""
from __future__ import annotations

import logging
import uuid
from collections import defaultdict

import polars as pl

from traceflow.config import Config
from traceflow.detectors import Cluster
from traceflow.graph_builder import build_edge_arrays

logger = logging.getLogger(__name__)


def pass_through(tx_df: pl.DataFrame, config: Config) -> list[Cluster]:
    """Detect rapid pass-through chains.

    A chain v_0 -> v_1 -> ... -> v_k is suspicious if:
      - k >= PASS_THROUGH_MIN_HOPS
      - For each intermediate node v_i (1 <= i < k):
          t_in(v_i) < t_out(v_i) and
          (t_out(v_i) - t_in(v_i)) <= PASS_THROUGH_MAX_DWELL_HOURS * 3600
      - Total chain duration <= TIME_WINDOW_HOURS * 3600
    """
    if tx_df.is_empty():
        return []

    arrays = build_edge_arrays(tx_df)
    ts = arrays["ts"]
    src_idx = arrays["src_idx"]
    dst_idx = arrays["dst_idx"]
    tx_ids = arrays["tx_id"]
    idx_to_node = arrays["idx_to_node"]
    account_out = arrays["account_out_index"]

    max_dwell_s = config.PASS_THROUGH_MAX_DWELL_HOURS * 3600.0
    window_s = config.TIME_WINDOW_HOURS * 3600.0
    min_hops = config.PASS_THROUGH_MIN_HOPS
    cap = config.CLUSTER_SIZE_CAP

    found_chains: list[Cluster] = []
    seen_account_chains: set[tuple[int, ...]] = set()

    for start_node, out_edges in account_out.items():
        for first_e in out_edges:
            t_start = ts[first_e]
            first_dst = dst_idx[first_e]

            # DFS stack: (current_node, t_arrival, path_nodes, path_edges)
            stack = [(first_dst, t_start, [start_node, first_dst], [first_e])]

            while stack:
                curr_node, t_in, path_nodes, path_edges = stack.pop()
                hops = len(path_nodes) - 1

                # If minimum hops satisfied, record this chain if maximal or terminal
                curr_out = account_out.get(curr_node, [])
                can_extend = False

                for next_e in curr_out:
                    t_out = ts[next_e]
                    if t_out <= t_in:
                        continue
                    dwell = t_out - t_in
                    if dwell > max_dwell_s:
                        continue
                    if t_out - t_start > window_s:
                        break  # sorted by ts, future ones also exceed window

                    next_dst = dst_idx[next_e]
                    if next_dst in path_nodes:
                        continue  # avoid cycles here (handled by cycle detector)

                    can_extend = True
                    if len(path_nodes) < cap:
                        stack.append((
                            next_dst,
                            t_out,
                            path_nodes + [next_dst],
                            path_edges + [next_e],
                        ))

                if not can_extend and hops >= min_hops:
                    chain_tuple = tuple(path_nodes)
                    if chain_tuple not in seen_account_chains:
                        seen_account_chains.add(chain_tuple)
                        accounts = [idx_to_node[i] for i in path_nodes[:cap]]
                        e_ids = [tx_ids[e] for e in path_edges]
                        t_end = ts[path_edges[-1]]
                        duration_h = (t_end - t_start) / 3600.0

                        # Calculate dwells for intermediate nodes
                        dwell_map = {}
                        for i in range(1, len(path_nodes) - 1):
                            node_name = idx_to_node[path_nodes[i]]
                            in_t = ts[path_edges[i - 1]]
                            out_t = ts[path_edges[i]]
                            dwell_map[node_name] = max(0.0, out_t - in_t)

                        found_chains.append(
                            Cluster(
                                cluster_id=str(uuid.uuid4()),
                                typology=["pass_through"],
                                primary_typology="pass_through",
                                accounts=accounts,
                                edge_ids=e_ids,
                                start_time=t_start,
                                end_time=t_end,
                                duration_hours=duration_h,
                                size=len(accounts),
                                dwell=dwell_map,
                                chain_hops=hops,
                            )
                        )

    return found_chains
