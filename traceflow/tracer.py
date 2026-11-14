"""TraceFlow forward temporal tracer with dwell and retention constraints."""
from __future__ import annotations

import logging
import math
import uuid
from collections import defaultdict

import numpy as np
import polars as pl

from traceflow.config import Config
from traceflow.detectors import Cluster
from traceflow.graph_builder import build_edge_arrays

logger = logging.getLogger(__name__)


class TraceFlow:
    """Forward, time-respecting tracer that tracks dwell and retention."""

    def __init__(self, config: Config):
        self.config = config

    def trace(self, tx_df: pl.DataFrame) -> list[Cluster]:
        """Main trace execution."""
        if tx_df.is_empty():
            return []

        arrays = build_edge_arrays(tx_df)
        ts = arrays["ts"]
        src_idx = arrays["src_idx"]
        dst_idx = arrays["dst_idx"]
        amount = arrays["amount"]
        tx_ids = arrays["tx_id"]
        idx_to_node = arrays["idx_to_node"]
        account_out = arrays["account_out_index"]
        account_in = arrays["account_in_index"]

        window_s = self.config.TIME_WINDOW_HOURS * 3600.0
        max_dwell_s = self.config.PASS_THROUGH_MAX_DWELL_HOURS * 3600.0
        low_band = self.config.RETENTION_BAND_LOW
        high_band = self.config.RETENTION_BAND_HIGH
        cap = self.config.CLUSTER_SIZE_CAP

        clusters: list[Cluster] = []
        seen_paths: set[tuple[int, ...]] = set()

        for start_node, out_edges in account_out.items():
            for first_e in out_edges:
                t_start = ts[first_e]
                first_dst = dst_idx[first_e]

                # DFS: (current_node, t_arrival, in_edge, path_nodes, path_edges)
                stack = [(first_dst, t_start, first_e, [start_node, first_dst], [first_e])]

                while stack:
                    curr_node, t_in, prev_e, path_nodes, path_edges = stack.pop()
                    hops = len(path_nodes) - 1

                    curr_out = account_out.get(curr_node, [])
                    extended = False

                    for next_e in curr_out:
                        t_out = ts[next_e]
                        if t_out <= t_in:
                            continue
                        dwell = t_out - t_in
                        if dwell > max_dwell_s:
                            continue
                        if t_out - t_start > window_s:
                            break

                        next_dst = dst_idx[next_e]
                        if next_dst in path_nodes:
                            # Cycle detected within trace
                            cycle_nodes = path_nodes[path_nodes.index(next_dst):] + [next_dst]
                            if len(cycle_nodes) - 1 >= self.config.CYCLE_MIN_LENGTH:
                                # We can record cycle or continue
                                pass
                            continue

                        extended = True
                        if len(path_nodes) < cap:
                            stack.append((
                                next_dst,
                                t_out,
                                next_e,
                                path_nodes + [next_dst],
                                path_edges + [next_e],
                            ))

                    if not extended and hops >= 2:
                        path_tuple = tuple(path_nodes)
                        if path_tuple not in seen_paths:
                            seen_paths.add(path_tuple)
                            cluster = self._build_trace_cluster(
                                path_nodes, path_edges, arrays, window_s
                            )
                            if self._satisfies_retention_band(cluster, low_band, high_band):
                                clusters.append(cluster)

        logger.info("TraceFlow generated %d candidate clusters after filtering", len(clusters))
        return clusters

    def _build_trace_cluster(
        self,
        path_nodes: list[int],
        path_edges: list[int],
        arrays: dict,
        window_s: float,
    ) -> Cluster:
        ts = arrays["ts"]
        amount = arrays["amount"]
        tx_ids = arrays["tx_id"]
        idx_to_node = arrays["idx_to_node"]
        account_out = arrays["account_out_index"]
        account_in = arrays["account_in_index"]

        t_start = ts[path_edges[0]]
        t_end = ts[path_edges[-1]]
        duration_h = (t_end - t_start) / 3600.0

        dwell_dict: dict[str, float] = {}
        retention_dict: dict[str, float] = {}

        # For intermediate nodes
        for i in range(1, len(path_nodes) - 1):
            n_idx = path_nodes[i]
            node_name = idx_to_node[n_idx]
            t_in_hop = ts[path_edges[i - 1]]
            t_out_hop = ts[path_edges[i]]

            # Dwell time
            dwell = max(0.0, t_out_hop - t_in_hop)
            dwell_dict[node_name] = dwell

            # Retention ratio: sum(out in window) / sum(in in window)
            # Find in-edges for n_idx in [t_in_hop - window_s, t_in_hop]
            in_sum = 0.0
            for e_in in account_in.get(n_idx, []):
                t_e = ts[e_in]
                if t_in_hop - window_s <= t_e <= t_out_hop:
                    in_sum += amount[e_in]

            out_sum = 0.0
            for e_out in account_out.get(n_idx, []):
                t_e = ts[e_out]
                if t_in_hop <= t_e <= t_in_hop + window_s:
                    out_sum += amount[e_out]

            if in_sum > 0:
                ret = out_sum / in_sum
            else:
                ret = float("nan")

            retention_dict[node_name] = ret

        # End-to-end retention: product of valid intermediate retentions
        valid_rets = [r for r in retention_dict.values() if not math.isnan(r)]
        if valid_rets:
            end_to_end = float(np.prod(valid_rets))
        else:
            end_to_end = None

        accounts = [idx_to_node[i] for i in path_nodes]
        edge_ids = [tx_ids[e] for e in path_edges]

        # Determine typology
        typologies = ["pass_through"]
        if len(path_nodes) >= 4 and abs(path_nodes[0] - path_nodes[-1]) == 0:
            typologies.append("cycle")

        return Cluster(
            cluster_id=str(uuid.uuid4()),
            typology=typologies,
            primary_typology=typologies[0],
            accounts=accounts,
            edge_ids=edge_ids,
            start_time=t_start,
            end_time=t_end,
            duration_hours=duration_h,
            size=len(accounts),
            dwell=dwell_dict,
            retention=retention_dict,
            end_to_end_retention=end_to_end,
            chain_hops=len(path_nodes) - 1,
        )

    def _satisfies_retention_band(
        self, cluster: Cluster, low_band: float, high_band: float
    ) -> bool:
        if not cluster.retention:
            return True
        for ret in cluster.retention.values():
            if math.isnan(ret):
                continue
            # If any node has retention within or near the band
            if low_band <= ret <= high_band:
                return True
        return False
