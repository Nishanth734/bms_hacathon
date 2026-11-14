import pytest
import polars as pl
from traceflow.schema_parser import detect_schema_type, parse_transaction_file
from traceflow.scc import compute_scc_clusters, get_wallet_scc_map
from traceflow.detectors.wash_trading import detect_wash_trading
from traceflow.config import Config

def test_detect_schema_type_nft():
    cols = ["tx_hash", "timestamp", "seller_address", "buyer_address", "token_id", "price_eth"]
    assert detect_schema_type(cols) == "nft"

def test_detect_schema_type_banking():
    cols = ["Timestamp", "From Bank", "Account", "To Bank", "Account.1", "Amount Paid", "Is Laundering"]
    assert detect_schema_type(cols) == "banking"

def test_parse_nft_sample_file():
    df, meta = parse_transaction_file("data/NFT_WashTrading_Sample.csv")
    assert meta["schema_type"] == "nft"
    assert meta["row_count"] > 100
    assert "token_id" in df.columns
    assert "tx_id" in df.columns
    assert "src" in df.columns
    assert "dst" in df.columns

def test_scc_clusters_cycle():
    # A -> B -> C -> A (cycle = SCC of size 3)
    data = {
        "tx_id": ["1", "2", "3", "4"],
        "ts": [10.0, 20.0, 30.0, 40.0],
        "src": ["W1", "W2", "W3", "W4"],
        "dst": ["W2", "W3", "W1", "W5"],
        "amount": [1.0, 1.0, 1.0, 1.0],
        "currency": ["ETH", "ETH", "ETH", "ETH"],
        "token_id": [None, None, None, None],
        "collection": [None, None, None, None],
        "label": [0, 0, 0, 0]
    }
    df = pl.DataFrame(data)
    sccs = compute_scc_clusters(df)
    assert len(sccs) == 1
    assert sccs[0]["size"] == 3
    assert set(sccs[0]["wallets"]) == {"W1", "W2", "W3"}

    scc_map = get_wallet_scc_map(df)
    assert scc_map["W1"] == 1
    assert scc_map["W2"] == 1
    assert scc_map["W3"] == 1
    assert "W4" not in scc_map

def test_wash_trading_detector():
    # Same token 999 sold from A -> B -> C -> A
    data = {
        "tx_id": ["tx1", "tx2", "tx3"],
        "ts": [100.0, 200.0, 300.0],
        "src": ["0xA", "0xB", "0xC"],
        "dst": ["0xB", "0xC", "0xA"],
        "amount": [5.0, 8.0, 12.0],
        "currency": ["ETH", "ETH", "ETH"],
        "token_id": ["999", "999", "999"],
        "collection": ["0xBAYC", "0xBAYC", "0xBAYC"],
        "label": [1, 1, 1]
    }
    df = pl.DataFrame(data)
    clusters = detect_wash_trading(df, window_hours=24.0)
    assert len(clusters) == 1
    assert clusters[0].primary_typology == "wash_trading"
    assert set(clusters[0].accounts) == {"0xA", "0xB", "0xC"}
    assert clusters[0].edge_ids == ["tx1", "tx2", "tx3"]
