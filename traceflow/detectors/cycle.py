"""Temporal cycle typology detector for TraceFlow.

Finds directed temporal cycles of length min_len to max_len where each hop's
timestamp is strictly greater than the preceding hop, and the whole cycle
completes within TIME_WINDOW_HOURS.
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


def cycle(tx_df: pl.DataFrame, config: Config) -> list[Cluster]:
    """Detect temporal cycles with strict time-ordering.

    A cycle A -> B -> C -> ... -> A is valid iff:
      t(A->B) < t(B->C) < ... < t(last->A)
      and t(last->A) - t(A->B) <= TIME_WINDOW_HOURS * 3600
      and min_len <= hop_count <= max_len.
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

    window_s = config.TIME_WINDOW_HOURS * 3600.0
    min_len = config.CYCLE_MIN_LENGTH
    max_len = config.CYCLE_MAX_LENGTH
    cap = config.CLUSTER_SIZE_CAP

    found_cycles: list[Cluster] = []
    seen_account_sets: set[frozenset[int]] = set()

    # Iterate through potential start nodes
    # For speed, only consider nodes that have both outgoing and incoming edges
    nodes_with_out = set(account_out.keys())
    nodes_with_in = set(arrays["account_in_index"].keys())
    candidate_start_nodes = list(nodes_with_out.intersection(nodes_with_in))

    for start_node in candidate_start_nodes:
        # Start node outgoing edges
        out_edges = account_out.get(start_node, [])
        for first_e_idx in out_edges:
            t_start = ts[first_e_idx]
            first_dst = dst_idx[first_e_idx]
            if first_dst == start_node:
                continue  # self-loop, ignore

            # Stack for DFS: (current_node, current_t, path_nodes, path_edges)
            stack = [(first_dst, t_start, [start_node, first_dst], [first_e_idx])]

            while stack:
                curr_node, curr_t, path_nodes, path_edges = stack.pop()
                hop_count = len(path_nodes) - 1

                curr_out = account_out.get(curr_node, [])
                for next_e_idx in curr_out:
                    next_t = ts[next_e_idx]
                    if next_t <= curr_t:
                        continue  # Must be strictly time-ordered
                    if next_t - t_start > window_s:
                        break  # since account_out is sorted by ts, later edges will also exceed window

                    next_dst = dst_idx[next_e_idx]

                    if next_dst == start_node:
                        # Cycle completed!
                        cycle_hops = hop_count + 1
                        if min_len <= cycle_hops <= max_len:
                            cycle_acc_set = frozenset(path_nodes)
                            if cycle_acc_set not in seen_account_sets:
                                seen_account_sets.add(cycle_acc_set)
                                cycle_nodes = [idx_to_node[idx] for idx in path_nodes[:cap]]
                                cycle_tx_ids = [tx_ids[e] for e in (path_edges + [next_e_idx])]
                                duration_h = (next_t - t_start) / 3600.0

                                found_cycles.append(
                                    Cluster(
                                        cluster_id=str(uuid.uuid4()),
                                        typology=["cycle"],
                                        primary_typology="cycle",
                                        accounts=cycle_nodes,
                                        edge_ids=cycle_tx_ids,
                                        start_time=t_start,
                                        end_time=next_t,
                                        duration_hours=duration_h,
                                        size=len(cycle_nodes),
                                    )
                                )
                    elif next_dst not in path_nodes and (hop_count + 1) < max_len:
                        # Continue search
                        stack.append((
                            next_dst,
                            next_t,
                            path_nodes + [next_dst],
                            path_edges + [next_e_idx],
                        ))

    return found_cycles
