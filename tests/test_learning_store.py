"""
Unit and integration tests for TraceFlow Learning Case Store and Feedback.
Covers: add, approve, reject, duplicate update, audit log writing, unsure queue prioritization,
and approved_training_rows filtering.
"""
import os
import shutil
from pathlib import Path
import pytest
import polars as pl

from traceflow.learning.case_store import (
    CASE_STORE_PATH,
    CASE_STORE_LOG_PATH,
    add_case,
    approve,
    reject,
    list_cases,
    approved_training_rows,
    record_analyst_feedback,
    uncertainty_queue,
)

@pytest.fixture(autouse=True)
def clean_case_store(tmp_path, monkeypatch):
    """Isolate case store and log to temporary directory for clean test state."""
    test_store = tmp_path / "case_store.parquet"
    test_log = tmp_path / "case_store_log.csv"
    monkeypatch.setattr("traceflow.learning.case_store.CASE_STORE_PATH", test_store)
    monkeypatch.setattr("traceflow.learning.case_store.CASE_STORE_LOG_PATH", test_log)
    yield

def test_01_add_case():
    case = add_case(
        case_id="case_001",
        cluster_id="clust_001",
        edge_ids=["tx_1", "tx_2"],
        accounts=["acc_a", "acc_b"],
        typology="cycle",
        label=1,
        source="analyst",
        source_ref="Senior Analyst Jane",
        status="pending",
    )
    assert case["case_id"] == "case_001"
    assert case["cluster_id"] == "clust_001"
    assert case["label"] == 1
    assert case["status"] == "pending"

    cases = list_cases()
    assert len(cases) == 1
    assert cases[0]["case_id"] == "case_001"

def test_02_approve_and_reject():
    add_case(case_id="case_app", cluster_id="c_app", status="pending")
    add_case(case_id="case_rej", cluster_id="c_rej", status="pending")

    # Approve
    app_res = approve("case_app", by="Analyst Dan")
    assert app_res["status"] == "approved"
    assert app_res["approved_by"] == "Analyst Dan"

    # Reject
    rej_res = reject("case_rej", by="Analyst Dan")
    assert rej_res["status"] == "rejected"
    assert rej_res["approved_by"] == "Analyst Dan"

    # Check approved only
    approved = approved_training_rows()
    assert len(approved) == 1
    assert approved[0]["case_id"] == "case_app"

def test_03_duplicate_cluster_update_latest_label_wins():
    add_case(case_id="case_1", cluster_id="clust_same", label=1, status="pending")
    # Duplicate cluster_id feedback with new label
    add_case(case_id="case_2", cluster_id="clust_same", label=0, status="approved", approved_by="Supervisor")

    all_c = list_cases()
    # Must update existing, not create duplicate
    assert len(all_c) == 1
    assert all_c[0]["cluster_id"] == "clust_same"
    assert all_c[0]["label"] == 0
    assert all_c[0]["status"] == "approved"

def test_04_audit_log_written_for_every_change():
    add_case(case_id="log_case_1", cluster_id="c_log", status="pending")
    approve("log_case_1", by="Lead Auditor")
    reject("log_case_1", by="Lead Auditor")

    from traceflow.learning.case_store import CASE_STORE_LOG_PATH
    assert CASE_STORE_LOG_PATH.exists()

    with open(CASE_STORE_LOG_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()
    # Header + 3 operations = 4 lines
    assert len(lines) == 4
    assert "add_case" in lines[1]
    assert "approve_case" in lines[2]
    assert "reject_case" in lines[3]

def test_05_analyst_feedback_confirm_reject_unsure():
    # Confirm
    res_c = record_analyst_feedback("c_confirm", "confirm", "Analyst_A")
    assert res_c["label"] == 1
    assert res_c["status"] == "approved"

    # Reject
    res_r = record_analyst_feedback("c_reject", "reject", "Analyst_A")
    assert res_r["label"] == 0
    assert res_r["status"] == "approved"

    # Unsure
    res_u = record_analyst_feedback("c_unsure", "unsure", "Analyst_A")
    assert res_u["status"] == "pending"

def test_06_unsure_prioritized_in_uncertainty_queue():
    # Mark one cluster as unsure (pending)
    record_analyst_feedback("clust_unsure", "unsure", "Analyst_A")

    scores = [
        {"cluster_id": "c_high", "risk_score": 0.95},
        {"cluster_id": "c_mid", "risk_score": 0.52},
        {"cluster_id": "clust_unsure", "risk_score": 0.85},
    ]

    q = uncertainty_queue(scores, threshold=0.5)
    # The pending unsure cluster must be at the front of the queue
    assert q[0]["cluster_id"] == "clust_unsure"
    # Followed by the one closest to threshold 0.5 (abs(0.52 - 0.50) = 0.02)
    assert q[1]["cluster_id"] == "c_mid"
    assert q[2]["cluster_id"] == "c_high"
