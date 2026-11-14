"""
Unit and integration tests for TraceFlow External Incident Ingestion.
Tests:
- tx_ids never collide with base edges (offset >= 10,000,000,000)
- base edges file is byte-identical before and after ingest
- incident cluster has exactly the feature columns of features
- extraction with invented account is rejected by anti-hallucination verifier
- incident stays pending and is NOT returned by approved_training_rows() until approved
"""
import io
import os
import shutil
from pathlib import Path
import pytest
import polars as pl

from traceflow.features import build_feature_row
from traceflow.learning.case_store import approved_training_rows, approve
from traceflow.learning import incident as incident_module
from traceflow.learning.incident import (
    ingest_incident,
    extract_incident,
    verify_extraction_grounding,
    IncidentModel,
    TransactionInput,
)

@pytest.fixture(autouse=True)
def clean_incident_paths(tmp_path, monkeypatch):
    """Isolate incident edges and case store for clean test runs."""
    test_inc_edges = tmp_path / "incident_edges.parquet"
    test_case_store = tmp_path / "case_store.parquet"
    test_case_log = tmp_path / "case_store_log.csv"
    monkeypatch.setattr("traceflow.learning.incident.INCIDENT_EDGES_PATH", test_inc_edges)
    monkeypatch.setattr("traceflow.learning.case_store.CASE_STORE_PATH", test_case_store)
    monkeypatch.setattr("traceflow.learning.case_store.CASE_STORE_LOG_PATH", test_case_log)
    yield

def test_01_tx_id_offset_and_edges_isolation(tmp_path):
    """Test that tx_ids start at offset >= 10,000,000,000 and base edges file is untouched."""
    base_edges_file = tmp_path / "edges.parquet"
    base_df = pl.DataFrame({
        "tx_id": ["0", "1", "2"],
        "ts": [1640000000.0, 1640000100.0, 1640000200.0],
        "src": ["BankA_1", "BankB_2", "BankC_3"],
        "dst": ["BankB_2", "BankC_3", "BankA_1"],
        "amount": [1000.0, 950.0, 900.0],
        "label": [1, 1, 1],
    })
    base_df.write_parquet(str(base_edges_file))
    before_bytes = base_edges_file.read_bytes()

    incident = {
        "title": "Operation Black Chain Scam",
        "source_ref": "FinCEN Advisory 2026-08",
        "typology": "cycle",
        "transactions": [
            {"src": "BankX_101", "dst": "BankY_202", "amount": 250000.0, "currency": "USD", "ts": 1700000000.0},
            {"src": "BankY_202", "dst": "BankZ_303", "amount": 245000.0, "currency": "USD", "ts": 1700003600.0},
            {"src": "BankZ_303", "dst": "BankX_101", "amount": 240000.0, "currency": "USD", "ts": 1700007200.0},
        ],
    }

    res = ingest_incident(incident)

    # 1. Base edges must remain byte-identical
    after_bytes = base_edges_file.read_bytes()
    assert before_bytes == after_bytes

    # 2. tx_ids must be >= 10,000,000,000
    for eid in res["edge_ids"]:
        assert int(eid) >= 10_000_000_000

    # 3. Incident edges parquet was created
    assert incident_module.INCIDENT_EDGES_PATH.exists()
    inc_df = pl.read_parquet(str(incident_module.INCIDENT_EDGES_PATH))
    assert inc_df.height == 3
    assert all(int(t) >= 10_000_000_000 for t in inc_df["tx_id"].to_list())

def test_02_feature_columns_match_standard_features():
    """Verify incident cluster generates the exact standard feature columns."""
    incident = {
        "title": "Mule Relay Funnel",
        "source_ref": "Cybersecurity Bulletin",
        "typology": "pass_through",
        "transactions": [
            {"src": "Mule_A", "dst": "Mule_B", "amount": 50000.0, "currency": "USD", "ts": 1700000000.0},
            {"src": "Mule_B", "dst": "Mule_C", "amount": 49000.0, "currency": "USD", "ts": 1700001800.0},
        ],
    }
    res = ingest_incident(incident)
    features = res["features"]

    expected_cols = [
        "cluster_id", "size", "duration_hours", "edge_count", "amount_total",
        "amount_mean", "amount_std", "max_in_degree", "max_out_degree",
        "fan_out_count", "cycle_count", "pass_through_count", "mean_dwell_seconds",
        "mean_retention", "end_to_end_retention", "is_fan_out", "is_fan_in",
        "is_cycle", "is_pass_through", "label"
    ]
    for col in expected_cols:
        assert col in features, f"Missing feature column: {col}"

def test_03_anti_hallucination_verifier_rejects_invented_facts():
    """Verify extraction rejects hallucinated account numbers or amounts."""
    report = "On 15 Oct, BankA_001 transferred $50,000 to BankB_002. Later BankB_002 sent funds downstream."

    # Valid extraction
    extracted = extract_incident(report)
    assert len(extracted["transactions"]) >= 1
    assert extracted["transactions"][0]["src"] == "BankA_001"
    assert extracted["transactions"][0]["dst"] == "BankB_002"

    # Now verify anti-hallucination rejection if an invented account or amount is present
    hallucinated_txs = [
        {"src": "BankA_001", "dst": "GhostBank_999", "amount": 50000.0, "currency": "USD", "ts": 1700000000.0}
    ]
    with pytest.raises(ValueError, match="Anti-hallucination rejection"):
        verify_extraction_grounding(report, hallucinated_txs)

    hallucinated_amt_txs = [
        {"src": "BankA_001", "dst": "BankB_002", "amount": 999999.0, "currency": "USD", "ts": 1700000000.0}
    ]
    with pytest.raises(ValueError, match="Anti-hallucination rejection"):
        verify_extraction_grounding(report, hallucinated_amt_txs)

def test_04_incident_pending_until_approved():
    """Verify incident stays pending and is not included in training set until approved."""
    incident = {
        "title": "Pending Scam",
        "source_ref": "SAR Notice",
        "typology": "cycle",
        "transactions": [
            {"src": "BankA_10", "dst": "BankB_20", "amount": 10000.0, "currency": "USD", "ts": 1700000000.0},
            {"src": "BankB_20", "dst": "BankA_10", "amount": 9900.0, "currency": "USD", "ts": 1700003600.0},
        ],
    }
    res = ingest_incident(incident)
    case_id = res["case_id"]

    # Must be pending initially
    assert res["status"] == "pending"
    assert len(approved_training_rows()) == 0

    # Approve the incident case
    approve(case_id, by="Supervising Officer")

    # Now must be in approved training rows
    approved = approved_training_rows()
    assert len(approved) == 1
    assert approved[0]["case_id"] == case_id
    assert approved[0]["source"] == "incident"
