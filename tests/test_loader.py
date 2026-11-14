"""Tests for traceflow.loader."""
import pytest
import polars as pl
from traceflow.loader import load_csv, validate_schema, SchemaError

def test_load_csv_returns_dataframe(tiny_csv_path):
    df = load_csv(tiny_csv_path)
    assert isinstance(df, pl.DataFrame)
    assert len(df) == 25

def test_required_columns_present(tiny_df):
    required = ["tx_id", "ts", "src", "dst", "amount", "currency", "label", "payment_format"]
    for col in required:
        assert col in tiny_df.columns

def test_node_id_format(tiny_df):
    for src in tiny_df["src"].to_list():
        assert "_" in src
        parts = src.split("_")
        assert len(parts) >= 2

def test_time_sorted(tiny_df):
    ts_list = tiny_df["ts"].to_list()
    assert ts_list == sorted(ts_list)

def test_no_null_required_fields(tiny_df):
    required = ["tx_id", "ts", "src", "dst", "amount", "currency", "label"]
    for col in required:
        assert tiny_df[col].null_count() == 0

def test_schema_error_on_wrong_columns(tmp_path):
    bad_csv = tmp_path / "bad.csv"
    bad_csv.write_text("ColA,ColB\n1,2\n")
    with pytest.raises(SchemaError):
        load_csv(str(bad_csv))

def test_zero_amount_retained(tmp_path):
    csv_file = tmp_path / "zero_amt.csv"
    csv_file.write_text(
        "Timestamp,From Bank,Account,To Bank,Account.1,Amount Received,Receiving Currency,Amount Paid,Payment Currency,Payment Format,Is Laundering\n"
        "2022/01/01 10:00,B1,A1,B2,A2,0.00,USD,0.00,USD,Wire,0\n"
    )
    df = load_csv(str(csv_file))
    assert len(df) == 1
    assert df["amount"][0] == 0.0

def test_label_values(tiny_df):
    labels = set(tiny_df["label"].unique().to_list())
    assert labels.issubset({0, 1})

def test_parquet_output(tiny_csv_path, tmp_path):
    out_p = str(tmp_path / "out.parquet")
    df = load_csv(tiny_csv_path, out_parquet=out_p)
    loaded_p = pl.read_parquet(out_p)
    assert len(df) == len(loaded_p)
