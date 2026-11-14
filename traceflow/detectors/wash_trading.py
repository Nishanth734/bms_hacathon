"""
NFT Wash Trading Detector.
Detects circular token sales, price inflation rings, and coordinated volume churning.
"""
from typing import List, Dict, Any
from collections import defaultdict
import uuid
import polars as pl
from traceflow.detectors import Cluster

def detect_wash_trading(
    df: pl.DataFrame,
    window_hours: float = 72.0,
    min_churn_count: int = 2
) -> List[Cluster]:
    """
    Identifies wash trading patterns:
    1. Same-token round-trip (token_id originates and returns to the same or confederate wallet).
    2. Coordinated token churning between a pair or group of wallets.
    """
    clusters: List[Cluster] = []
    window_sec = window_hours * 3600.0

    # Filter for rows that have token_id
    token_rows = df.filter(pl.col("token_id").is_not_null())
    if len(token_rows) == 0:
        return clusters

    # Group by token_id and collection
    # Note: Sort by ts
    tokens_dict = defaultdict(list)
    for row in token_rows.iter_rows(named=True):
        key = (row["collection"] or "default", str(row["token_id"]))
        tokens_dict[key].append(row)

    for (col, token_id), txs in tokens_dict.items():
        if len(txs) < 2:
            continue

        txs.sort(key=lambda x: x["ts"])
        n = len(txs)

        # Sliding window over transactions of this token
        for i in range(n):
            window_txs = [txs[i]]
            for j in range(i + 1, n):
                if txs[j]["ts"] - txs[i]["ts"] <= window_sec:
                    window_txs.append(txs[j])
                else:
                    break

            if len(window_txs) < min_churn_count:
                continue

            # Check if there is a cycle or repeat participant
            sellers = [t["src"] for t in window_txs]
            buyers = [t["dst"] for t in window_txs]
            all_participants = set(sellers).union(set(buyers))

            # Wash trade condition: a seller appears as buyer earlier/later for the same token,
            # or the original seller re-acquires the token.
            re_acquired = False
            for s in sellers:
                if s in buyers:
                    re_acquired = True
                    break

            if re_acquired:
                edge_ids = [str(t["tx_id"]) for t in window_txs]
                start_ts = window_txs[0]["ts"]
                end_ts = window_txs[-1]["ts"]

                # Check if this cluster is already covered
                exists = False
                for c in clusters:
                    if set(edge_ids).issubset(set(c.edge_ids)):
                        exists = True
                        break

                if not exists:
                    duration = max(0.0, (end_ts - start_ts) / 3600.0)
                    clusters.append(Cluster(
                        cluster_id=str(uuid.uuid4()),
                        typology=["wash_trading"],
                        primary_typology="wash_trading",
                        accounts=list(all_participants),
                        edge_ids=edge_ids,
                        start_time=start_ts,
                        end_time=end_ts,
                        duration_hours=duration,
                        size=len(all_participants)
                    ))

    return clusters
