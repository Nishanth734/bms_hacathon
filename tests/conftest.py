"""Pytest fixtures for the TraceFlow AML pipeline tests."""
from __future__ import annotations

import csv
from datetime import datetime, timedelta
import pytest
import polars as pl
from traceflow.config import Config
from traceflow.detectors import Cluster
from traceflow.loader import load_csv

@pytest.fixture
def sample_config(tmp_path):
    cfg = Config()
    cfg.RESULTS_DIR = str(tmp_path / "results")
    cfg.MODELS_DIR = str(tmp_path / "models")
    cfg.TIME_WINDOW_HOURS = 24.0
    cfg.FAN_IN_OUT_MIN_COUNTERPARTIES = 4
    cfg.CYCLE_MIN_LENGTH = 3
    cfg.CYCLE_MAX_LENGTH = 4
    cfg.PASS_THROUGH_MIN_HOPS = 3
    cfg.PASS_THROUGH_MAX_DWELL_HOURS = 1.0
    cfg.RETENTION_BAND_LOW = 0.85
    cfg.RETENTION_BAND_HIGH = 1.0
    cfg.CLUSTER_SIZE_CAP = 30
    return cfg

@pytest.fixture
def tiny_csv_path(tmp_path):
    csv_file = tmp_path / "tiny_ibm.csv"
    header = [
        "Timestamp", "From Bank", "Account", "To Bank", "Account.1",
        "Amount Received", "Receiving Currency", "Amount Paid", "Payment Currency",
        "Payment Format", "Is Laundering"
    ]
    base_t = datetime(2022, 1, 1, 10, 0, 0)
    rows = []
    # 25 transactions
    for i in range(25):
        t = base_t + timedelta(hours=i * 2)
        rows.append({
            "Timestamp": t.strftime("%Y/%m/%d %H:%M"),
            "From Bank": f"Bank_{i % 5}",
            "Account": f"Acc_{i % 5}",
            "To Bank": f"Bank_{(i + 1) % 5}",
            "Account.1": f"Acc_{(i + 1) % 5}",
            "Amount Received": f"{10000.0 + i * 500}",
            "Receiving Currency": "USD",
            "Amount Paid": f"{10000.0 + i * 500}",
            "Payment Currency": "USD",
            "Payment Format": "Wire",
            "Is Laundering": "1" if i % 4 == 0 else "0",
        })
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        writer.writerows(rows)
    return str(csv_file)

@pytest.fixture
def tiny_df(tiny_csv_path):
    return load_csv(tiny_csv_path)

@pytest.fixture
def planted_cycle_df(tmp_path):
    # A -> B -> C -> A strictly time ordered
    csv_file = tmp_path / "cycle.csv"
    header = [
        "Timestamp", "From Bank", "Account", "To Bank", "Account.1",
        "Amount Received", "Receiving Currency", "Amount Paid", "Payment Currency",
        "Payment Format", "Is Laundering"
    ]
    t0 = datetime(2022, 1, 1, 10, 0, 0)
    rows = [
        {"Timestamp": t0.strftime("%Y/%m/%d %H:%M"), "From Bank": "B1", "Account": "A", "To Bank": "B2", "Account.1": "B", "Amount Received": "50000", "Receiving Currency": "USD", "Amount Paid": "50000", "Payment Currency": "USD", "Payment Format": "Wire", "Is Laundering": "1"},
        {"Timestamp": (t0 + timedelta(hours=1)).strftime("%Y/%m/%d %H:%M"), "From Bank": "B2", "Account": "B", "To Bank": "B3", "Account.1": "C", "Amount Received": "49000", "Receiving Currency": "USD", "Amount Paid": "49000", "Payment Currency": "USD", "Payment Format": "Wire", "Is Laundering": "1"},
        {"Timestamp": (t0 + timedelta(hours=2)).strftime("%Y/%m/%d %H:%M"), "From Bank": "B3", "Account": "C", "To Bank": "B1", "Account.1": "A", "Amount Received": "48000", "Receiving Currency": "USD", "Amount Paid": "48000", "Payment Currency": "USD", "Payment Format": "Wire", "Is Laundering": "1"},
    ]
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        writer.writerows(rows)
    return load_csv(str(csv_file))

@pytest.fixture
def invalid_cycle_df(tmp_path):
    # Edges out of time order / outside window: same timestamp on hop 1 & 2
    csv_file = tmp_path / "invalid_cycle.csv"
    header = [
        "Timestamp", "From Bank", "Account", "To Bank", "Account.1",
        "Amount Received", "Receiving Currency", "Amount Paid", "Payment Currency",
        "Payment Format", "Is Laundering"
    ]
    t0 = datetime(2022, 1, 1, 10, 0, 0)
    rows = [
        {"Timestamp": t0.strftime("%Y/%m/%d %H:%M"), "From Bank": "B1", "Account": "A", "To Bank": "B2", "Account.1": "B", "Amount Received": "50000", "Receiving Currency": "USD", "Amount Paid": "50000", "Payment Currency": "USD", "Payment Format": "Wire", "Is Laundering": "1"},
        {"Timestamp": t0.strftime("%Y/%m/%d %H:%M"), "From Bank": "B2", "Account": "B", "To Bank": "B3", "Account.1": "C", "Amount Received": "49000", "Receiving Currency": "USD", "Amount Paid": "49000", "Payment Currency": "USD", "Payment Format": "Wire", "Is Laundering": "1"},
        {"Timestamp": (t0 + timedelta(hours=48)).strftime("%Y/%m/%d %H:%M"), "From Bank": "B3", "Account": "C", "To Bank": "B1", "Account.1": "A", "Amount Received": "48000", "Receiving Currency": "USD", "Amount Paid": "48000", "Payment Currency": "USD", "Payment Format": "Wire", "Is Laundering": "1"},
    ]
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        writer.writerows(rows)
    return load_csv(str(csv_file))

@pytest.fixture
def planted_fanout_df(tmp_path):
    csv_file = tmp_path / "fanout.csv"
    header = [
        "Timestamp", "From Bank", "Account", "To Bank", "Account.1",
        "Amount Received", "Receiving Currency", "Amount Paid", "Payment Currency",
        "Payment Format", "Is Laundering"
    ]
    t0 = datetime(2022, 1, 1, 10, 0, 0)
    rows = []
    for i in range(6):
        rows.append({
            "Timestamp": (t0 + timedelta(hours=i)).strftime("%Y/%m/%d %H:%M"),
            "From Bank": "CentralBank", "Account": "Hub1",
            "To Bank": f"BankDest_{i}", "Account.1": f"Acc_{i}",
            "Amount Received": "25000", "Receiving Currency": "USD",
            "Amount Paid": "25000", "Payment Currency": "USD",
            "Payment Format": "Wire", "Is Laundering": "1"
        })
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        writer.writerows(rows)
    return load_csv(str(csv_file))

@pytest.fixture
def planted_passthrough_df(tmp_path):
    csv_file = tmp_path / "passthrough.csv"
    header = [
        "Timestamp", "From Bank", "Account", "To Bank", "Account.1",
        "Amount Received", "Receiving Currency", "Amount Paid", "Payment Currency",
        "Payment Format", "Is Laundering"
    ]
    t0 = datetime(2022, 1, 1, 10, 0, 0)
    nodes = ["N0", "N1", "N2", "N3", "N4"]
    rows = []
    # 4 hops with 30 min dwell
    for i in range(4):
        rows.append({
            "Timestamp": (t0 + timedelta(minutes=i * 30)).strftime("%Y/%m/%d %H:%M"),
            "From Bank": "B", "Account": nodes[i],
            "To Bank": "B", "Account.1": nodes[i+1],
            "Amount Received": f"{100000.0 * (0.95**i)}", "Receiving Currency": "USD",
            "Amount Paid": f"{100000.0 * (0.95**i)}", "Payment Currency": "USD",
            "Payment Format": "Wire", "Is Laundering": "1"
        })
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        writer.writerows(rows)
    return load_csv(str(csv_file))

@pytest.fixture
def sample_cluster():
    return Cluster(
        cluster_id="test_cluster_001",
        typology=["cycle"],
        primary_typology="cycle",
        accounts=["B1_A", "B2_B", "B3_C"],
        edge_ids=["0", "1", "2"],
        start_time=1641031200.0,
        end_time=1641038400.0,
        duration_hours=2.0,
        size=3,
        risk_score=0.92,
        label=1,
        dwell={"B2_B": 1800.0},
        retention={"B2_B": 0.98},
        end_to_end_retention=0.98,
        chain_hops=3,
    )

@pytest.fixture
def sample_evidence():
    return {
        "cluster_id": "test_cluster_001",
        "typology": ["cycle"],
        "primary_typology": "cycle",
        "risk_score": 0.92,
        "window_start": "2022-01-01T10:00:00Z",
        "window_end": "2022-01-01T12:00:00Z",
        "accounts": ["B1_A", "B2_B", "B3_C"],
        "dwell": {"B2_B": 1800.0},
        "retention": {"B2_B": 0.98},
        "end_to_end_retention": 0.98,
        "edges": [
            {"edge_id": "0", "src": "B1_A", "dst": "B2_B", "amount": 50000.0, "currency": "USD", "ts": "2022-01-01T10:00:00Z"},
            {"edge_id": "1", "src": "B2_B", "dst": "B3_C", "amount": 49000.0, "currency": "USD", "ts": "2022-01-01T11:00:00Z"},
            {"edge_id": "2", "src": "B3_C", "dst": "B1_A", "amount": 48000.0, "currency": "USD", "ts": "2022-01-01T12:00:00Z"},
        ]
    }
