"""
TraceFlow Case Store and Feedback Engine.
Manages persistent analyst case approvals, incident cases, and audit logs.
Storage: data/case_store.parquet, data/case_store_log.csv
"""
from __future__ import annotations

import csv
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import polars as pl

CASE_STORE_PATH = Path("data/case_store.parquet")
CASE_STORE_LOG_PATH = Path("data/case_store_log.csv")

# Standard schema definition
CASE_STORE_SCHEMA = {
    "case_id": pl.Utf8,
    "cluster_id": pl.Utf8,
    "edge_ids": pl.List(pl.Utf8),
    "accounts": pl.List(pl.Utf8),
    "typology": pl.Utf8,
    "label": pl.Int32,
    "source": pl.Utf8,
    "source_ref": pl.Utf8,
    "status": pl.Utf8,  # "pending", "approved", "rejected"
    "added_at": pl.Utf8,
    "approved_by": pl.Utf8,
}


def _ensure_case_store() -> pl.DataFrame:
    """Ensure data/case_store.parquet exists and returns DataFrame."""
    CASE_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not CASE_STORE_PATH.exists():
        empty_df = pl.DataFrame(schema=CASE_STORE_SCHEMA)
        empty_df.write_parquet(str(CASE_STORE_PATH))
        return empty_df

    try:
        return pl.read_parquet(str(CASE_STORE_PATH))
    except Exception:
        empty_df = pl.DataFrame(schema=CASE_STORE_SCHEMA)
        empty_df.write_parquet(str(CASE_STORE_PATH))
        return empty_df


def _append_log(who: str, what: str, case_id: str, cluster_id: Optional[str] = "", details: str = "") -> None:
    """Append audit trail event to data/case_store_log.csv."""
    CASE_STORE_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    file_exists = CASE_STORE_LOG_PATH.exists()

    now_iso = datetime.now(timezone.utc).isoformat()
    with open(CASE_STORE_LOG_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["timestamp", "who", "what", "case_id", "cluster_id", "details"])
        writer.writerow([now_iso, who, what, case_id, cluster_id or "", details])


def add_case(
    case_id: Optional[str] = None,
    cluster_id: Optional[str] = None,
    edge_ids: Optional[List[Any]] = None,
    accounts: Optional[List[str]] = None,
    typology: str = "other",
    label: int = 1,
    source: str = "analyst",
    source_ref: str = "",
    status: str = "pending",
    approved_by: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Add or update a case in the case store.
    Duplicate cluster_id updates existing case; latest approved label wins.
    Appends audit log for every change.
    """
    df = _ensure_case_store()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Standardize edge_ids and accounts to string lists
    edge_ids_clean = [str(e) for e in (edge_ids or [])]
    accounts_clean = [str(a) for a in (accounts or [])]

    # Validate typology
    typology_clean = typology if typology in ("fan_in_out", "cycle", "pass_through", "other") else "other"
    label_int = int(label)
    status_clean = status.lower()

    existing_rows = df.to_dicts() if df.height > 0 else []
    target_idx = None

    # Check for duplicate: match by cluster_id if provided, else by case_id
    if cluster_id:
        for idx, row in enumerate(existing_rows):
            if row.get("cluster_id") == cluster_id:
                target_idx = idx
                break

    if target_idx is None and case_id:
        for idx, row in enumerate(existing_rows):
            if row.get("case_id") == case_id:
                target_idx = idx
                break

    if target_idx is not None:
        # Update existing case
        existing = existing_rows[target_idx]
        actual_case_id = existing["case_id"]
        existing["cluster_id"] = cluster_id or existing.get("cluster_id")
        if edge_ids_clean:
            existing["edge_ids"] = edge_ids_clean
        if accounts_clean:
            existing["accounts"] = accounts_clean
        existing["typology"] = typology_clean
        existing["label"] = label_int
        existing["source"] = source
        existing["source_ref"] = source_ref or existing.get("source_ref", "")
        existing["status"] = status_clean
        if approved_by:
            existing["approved_by"] = approved_by
        existing_rows[target_idx] = existing
        case_dict = existing
        _append_log(
            who=approved_by or source_ref or "system",
            what="update_case",
            case_id=actual_case_id,
            cluster_id=cluster_id,
            details=f"status={status_clean}, label={label_int}, typology={typology_clean}",
        )
    else:
        # Create new case
        actual_case_id = case_id or f"case_{uuid.uuid4().hex[:12]}"
        case_dict = {
            "case_id": actual_case_id,
            "cluster_id": cluster_id,
            "edge_ids": edge_ids_clean,
            "accounts": accounts_clean,
            "typology": typology_clean,
            "label": label_int,
            "source": source,
            "source_ref": source_ref,
            "status": status_clean,
            "added_at": now_iso,
            "approved_by": approved_by,
        }
        existing_rows.append(case_dict)
        _append_log(
            who=approved_by or source_ref or "system",
            what="add_case",
            case_id=actual_case_id,
            cluster_id=cluster_id,
            details=f"status={status_clean}, label={label_int}, source={source}",
        )

    # Persist updated parquet
    updated_df = pl.DataFrame(existing_rows, schema=CASE_STORE_SCHEMA)
    updated_df.write_parquet(str(CASE_STORE_PATH))
    return case_dict


def approve(case_id: str, by: str) -> Dict[str, Any]:
    """Approve a case in the store."""
    df = _ensure_case_store()
    existing_rows = df.to_dicts() if df.height > 0 else []

    target = None
    for r in existing_rows:
        if r["case_id"] == case_id or r.get("cluster_id") == case_id:
            r["status"] = "approved"
            r["approved_by"] = by
            target = r
            break

    if not target:
        raise ValueError(f"Case with ID '{case_id}' not found in case store.")

    updated_df = pl.DataFrame(existing_rows, schema=CASE_STORE_SCHEMA)
    updated_df.write_parquet(str(CASE_STORE_PATH))
    _append_log(
        who=by,
        what="approve_case",
        case_id=target["case_id"],
        cluster_id=target.get("cluster_id"),
        details=f"approved_by={by}, label={target.get('label')}",
    )
    return target


def reject(case_id: str, by: str) -> Dict[str, Any]:
    """Reject a case in the store."""
    df = _ensure_case_store()
    existing_rows = df.to_dicts() if df.height > 0 else []

    target = None
    for r in existing_rows:
        if r["case_id"] == case_id or r.get("cluster_id") == case_id:
            r["status"] = "rejected"
            r["approved_by"] = by
            target = r
            break

    if not target:
        raise ValueError(f"Case with ID '{case_id}' not found in case store.")

    updated_df = pl.DataFrame(existing_rows, schema=CASE_STORE_SCHEMA)
    updated_df.write_parquet(str(CASE_STORE_PATH))
    _append_log(
        who=by,
        what="reject_case",
        case_id=target["case_id"],
        cluster_id=target.get("cluster_id"),
        details=f"rejected_by={by}",
    )
    return target


def list_cases(status: Optional[str] = None) -> List[Dict[str, Any]]:
    """List cases filtered optionally by status."""
    df = _ensure_case_store()
    if df.height == 0:
        return []

    rows = df.to_dicts()
    if status:
        stat_norm = status.lower()
        return [r for r in rows if str(r.get("status", "")).lower() == stat_norm]
    return rows


def approved_training_rows() -> List[Dict[str, Any]]:
    """Return only approved cases eligible for retraining."""
    return list_cases(status="approved")


def record_analyst_feedback(
    cluster_id: str,
    decision: str,
    analyst: str,
    edge_ids: Optional[List[Any]] = None,
    accounts: Optional[List[str]] = None,
    typology: str = "other",
    notes: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Process analyst feedback decision: 'confirm', 'reject', or 'unsure'.
    - confirm: label=1, status='approved', approved_by=analyst
    - reject: label=0, status='approved', approved_by=analyst (verified non-laundering)
    - unsure: status='pending', moved to front of review queue
    """
    dec_norm = decision.strip().lower()
    ref_desc = f"{analyst}: {notes}" if notes else analyst
    if dec_norm == "confirm":
        return add_case(
            cluster_id=cluster_id,
            edge_ids=edge_ids,
            accounts=accounts,
            typology=typology,
            label=1,
            source="analyst",
            source_ref=ref_desc,
            status="approved",
            approved_by=analyst,
        )
    elif dec_norm == "reject":
        return add_case(
            cluster_id=cluster_id,
            edge_ids=edge_ids,
            accounts=accounts,
            typology=typology,
            label=0,
            source="analyst",
            source_ref=ref_desc,
            status="approved",
            approved_by=analyst,
        )
    elif dec_norm == "unsure":
        # Stored as pending and moved to review queue
        return add_case(
            cluster_id=cluster_id,
            edge_ids=edge_ids,
            accounts=accounts,
            typology=typology,
            label=1,
            source="analyst",
            source_ref=ref_desc,
            status="pending",
            approved_by=None,
        )
    else:
        raise ValueError(f"Invalid decision '{decision}'. Must be one of ['confirm', 'reject', 'unsure']")


def uncertainty_queue(
    scores: Optional[Union[List[Dict[str, Any]], pl.DataFrame]] = None,
    threshold: float = 0.5,
) -> List[Dict[str, Any]]:
    """
    Sort clusters by uncertainty: distance to the decision threshold abs(score - threshold).
    Clusters closest to threshold appear first. Any pending unsure cases are prepended.
    """
    if scores is None:
        scores_path = Path("data/scores.parquet")
        if scores_path.exists():
            score_rows = pl.read_parquet(str(scores_path)).to_dicts()
        else:
            clusters_path = Path("results/clusters.parquet")
            if not clusters_path.exists():
                clusters_path = Path("data/clusters.parquet")
            if clusters_path.exists():
                cdf = pl.read_parquet(str(clusters_path))
                score_rows = [
                    {"cluster_id": r.get("cluster_id"), "score": float(r.get("risk_score", 0.5))}
                    for r in cdf.to_dicts()
                ]
            else:
                score_rows = []
    elif isinstance(scores, pl.DataFrame):
        score_rows = scores.to_dicts()
    else:
        score_rows = list(scores)

    # Get pending cases to prioritize
    pending_cases = list_cases(status="pending")
    pending_cluster_ids = {p.get("cluster_id") for p in pending_cases if p.get("cluster_id")}

    def sort_key(row: Dict[str, Any]) -> tuple:
        cid = row.get("cluster_id")
        score = float(row.get("score") or row.get("risk_score") or 0.5)
        dist = abs(score - threshold)
        is_pending = cid in pending_cluster_ids
        # Primary: pending first (0), then by proximity to threshold (smallest distance first)
        return (0 if is_pending else 1, dist)

    sorted_scores = sorted(score_rows, key=sort_key)
    enriched_rows = []
    for r in sorted_scores:
        item = dict(r)
        sc = float(item.get("score") if item.get("score") is not None else item.get("risk_score", 0.5))
        dist = abs(sc - threshold)
        item["score"] = sc
        item["uncertainty"] = round(dist, 4)
        item["is_unsure"] = item.get("cluster_id") in pending_cluster_ids
        enriched_rows.append(item)
    return enriched_rows
