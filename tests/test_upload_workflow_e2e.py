"""
End-to-End Test Suite for TraceFlow Dataset Upload, Validation, and Dashboard Synchronization.
Tests:
1. Valid existing datasets (NFT & Banking).
2. Different column ordering.
3. Alternative column naming, casing, and spacing.
4. Missing required columns (clear error).
5. Empty or malformed CSV (clear error).
6. Consecutive uploads (complete active dataset replacement, no stale cache).
"""
import io
import pytest
from fastapi.testclient import TestClient
from api.main import app
from api.database import init_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

def test_01_upload_valid_nft_dataset():
    """Upload standard NFT CSV and verify active dataset and summary update."""
    with open("data/sample_test_nft.csv", "rb") as f:
        res = client.post("/api/datasets/upload", files={"file": ("sample_test_nft.csv", f, "text/csv")})
    
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["status"] == "uploaded"
    assert data["schema_type"] == "nft"
    assert data["row_count"] == 10
    assert data["wallet_count"] > 0
    ds_id = data["dataset_id"]

    # Verify summary endpoint reflects uploaded dataset
    sum_res = client.get(f"/api/analysis/summary?dataset_id={ds_id}")
    assert sum_res.status_code == 200
    s_data = sum_res.json()
    assert s_data["dataset_id"] == ds_id
    assert s_data["schema_type"] == "nft"
    assert s_data["total_transactions"] == 10
    assert s_data["total_volume"] > 0

    # Verify cases endpoint reflects uploaded dataset
    cases_res = client.get(f"/api/cases?dataset_id={ds_id}")
    assert cases_res.status_code == 200

def test_02_upload_valid_banking_dataset():
    """Upload standard Banking AML CSV and verify active dataset and summary update."""
    with open("data/sample_test_banking.csv", "rb") as f:
        res = client.post("/api/datasets/upload", files={"file": ("sample_test_banking.csv", f, "text/csv")})
    
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["status"] == "uploaded"
    assert data["schema_type"] == "banking"
    assert data["currency"] == "USD"
    ds_id = data["dataset_id"]

    sum_res = client.get(f"/api/analysis/summary?dataset_id={ds_id}")
    assert sum_res.status_code == 200
    s_data = sum_res.json()
    assert s_data["dataset_id"] == ds_id
    assert s_data["schema_type"] == "banking"
    assert s_data["currency"] == "USD"

def test_03_different_column_ordering_and_casing():
    """Upload CSV with scrambled column order, uppercase headers, and spacing."""
    csv_content = """ PRICE_ETH , BUYER_ADDRESS , TIMESTAMP , SELLER_ADDRESS , TOKEN_ID , TX_HASH , IS_WASH_TRADE 
15.5,0xBuyer_Alpha,1700100000,0xSeller_Beta,9901,0xhash_001,1
16.2,0xSeller_Beta,1700101800,0xBuyer_Alpha,9901,0xhash_002,1
"""
    res = client.post(
        "/api/datasets/upload",
        files={"file": ("scrambled.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["schema_type"] == "nft"
    assert data["row_count"] == 2
    assert data["total_volume"] == pytest.approx(31.7, 0.01)

def test_04_alternative_column_names_banking():
    """Upload Banking CSV with alternative names: source_bank, account_from, dest_bank, account_1, value, date."""
    csv_content = """source_bank,account_from,dest_bank,account_1,value,date,currency,is_laundering
Chase,1001,Citi,2001,50000.0,2026-05-14 09:00,USD,1
Citi,2001,Wells,3001,49500.0,2026-05-14 10:15,USD,1
Wells,3001,Chase,1001,49000.0,2026-05-14 11:30,USD,1
"""
    res = client.post(
        "/api/datasets/upload",
        files={"file": ("alt_banking.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["schema_type"] == "banking"
    assert data["row_count"] == 3
    assert data["total_volume"] == pytest.approx(148500.0, 0.01)

def test_05_missing_required_columns_rejection():
    """Upload CSV missing recipient/destination and verify meaningful error."""
    csv_content = """tx_hash,timestamp,seller_address,price_eth\n0x1,1700000000,0xAlice,5.0\n"""
    res = client.post(
        "/api/datasets/upload",
        files={"file": ("missing_col.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    )
    assert res.status_code == 400
    assert "Missing required recipient/destination column" in res.json()["detail"]

def test_06_empty_csv_rejection():
    """Upload empty file and verify meaningful error."""
    res = client.post(
        "/api/datasets/upload",
        files={"file": ("empty.csv", io.BytesIO(b""), "text/csv")}
    )
    assert res.status_code == 400
    assert "empty (0 bytes)" in res.json()["detail"]

def test_07_consecutive_uploads_state_replacement():
    """Upload dataset A then dataset B and verify active dataset completely changes with zero stale leakage."""
    # Upload A
    with open("data/sample_test_nft.csv", "rb") as f:
        res_a = client.post("/api/datasets/upload", files={"file": ("ds_a.csv", f, "text/csv")})
    assert res_a.status_code == 200
    id_a = res_a.json()["dataset_id"]

    # Verify active is A
    sum_a = client.get("/api/analysis/summary").json()
    assert sum_a["dataset_id"] == id_a
    assert sum_a["currency"] == "ETH"

    # Upload B
    with open("data/sample_test_banking.csv", "rb") as f:
        res_b = client.post("/api/datasets/upload", files={"file": ("ds_b.csv", f, "text/csv")})
    assert res_b.status_code == 200
    id_b = res_b.json()["dataset_id"]
    assert id_a != id_b

    # Verify active is now B and summary reflects B completely
    sum_b = client.get("/api/analysis/summary").json()
    assert sum_b["dataset_id"] == id_b
    assert sum_b["currency"] == "USD"
    assert sum_b["total_transactions"] == 5

    # Verify wallets reflect B
    wallets_b = client.get("/api/wallets").json()
    assert wallets_b["dataset_id"] == id_b
    assert wallets_b["total"] == 5
