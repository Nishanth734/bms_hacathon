"""
Unified schema parser for NFT and Banking transaction datasets.
Standardizes headers and extracts unified columns:
tx_id, ts, src, dst, amount, currency, token_id, collection, label.
"""
from pathlib import Path
from typing import Dict, Any, Tuple
import polars as pl
from datetime import datetime

def detect_schema_type(columns: list[str]) -> str:
    """Detect whether columns represent an NFT dataset or a Banking/AML dataset."""
    cols_lower = [c.lower() for c in columns]
    nft_indicators = {"token_id", "nft_id", "collection", "seller", "buyer", "price_eth", "contract_address"}
    banking_indicators = {"from bank", "to bank", "account.1", "is laundering", "payment format"}

    if any(ind in cols_lower for ind in nft_indicators):
        return "nft"
    if any(ind in cols_lower for ind in banking_indicators):
        return "banking"
    
    # Generic fallback: check if 'from' and 'to' or 'src' and 'dst' exist
    if any("from" in c or "seller" in c or "src" in c for c in cols_lower):
        return "nft"
    return "banking"

def parse_transaction_file(file_path: Path | str) -> Tuple[pl.DataFrame, Dict[str, Any]]:
    """
    Parse a CSV file into a standardized Polars DataFrame.
    Returns (standardized_df, metadata_dict).
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")

    # Read schema first
    df_raw = pl.read_csv(path, n_rows=100)
    columns = df_raw.columns
    schema_type = detect_schema_type(columns)

    if schema_type == "banking":
        # Load full banking dataset
        df = pl.read_csv(path, null_values=["", "NA", "null"])
        
        # Build node IDs: Bank + Account
        df = df.with_columns([
            pl.concat_str([pl.col("From Bank"), pl.lit("_"), pl.col("Account")]).alias("src"),
            pl.concat_str([pl.col("To Bank"), pl.lit("_"), pl.col("Account.1")]).alias("dst"),
            pl.col("Amount Paid").cast(pl.Float64, strict=False).alias("amount"),
            pl.col("Payment Currency").cast(pl.Utf8).alias("currency"),
            pl.lit(None).cast(pl.Utf8).alias("token_id"),
            pl.lit(None).cast(pl.Utf8).alias("collection"),
            pl.col("Is Laundering").cast(pl.Int32).alias("label"),
        ])

        # Parse timestamp
        # Handle string datetime or numeric timestamp
        ts_dtype = df["Timestamp"].dtype
        if ts_dtype == pl.Utf8:
            df = df.with_columns(
                pl.col("Timestamp").str.strptime(pl.Datetime, format="%Y/%m/%d %H:%M", strict=False)
                .dt.timestamp("ms")
                .truediv(1000.0)
                .alias("ts")
            )
        else:
            df = df.with_columns(pl.col("Timestamp").cast(pl.Float64).alias("ts"))

        df = df.with_columns(
            pl.int_range(0, pl.len()).cast(pl.Utf8).alias("tx_id")
        )

    else:
        # Load NFT dataset
        df = pl.read_csv(path, null_values=["", "NA", "null"])
        cols_map = {c.lower(): c for c in df.columns}

        # Resolve tx_id
        tx_col = cols_map.get("tx_hash") or cols_map.get("transaction_hash") or cols_map.get("tx_id") or cols_map.get("hash")
        # Resolve timestamp
        ts_col = cols_map.get("timestamp") or cols_map.get("block_timestamp") or cols_map.get("time") or cols_map.get("date")
        # Resolve src (seller/from)
        src_col = cols_map.get("seller_address") or cols_map.get("from_address") or cols_map.get("from") or cols_map.get("seller") or cols_map.get("src")
        # Resolve dst (buyer/to)
        dst_col = cols_map.get("buyer_address") or cols_map.get("to_address") or cols_map.get("to") or cols_map.get("buyer") or cols_map.get("dst")
        # Resolve amount / price
        amt_col = cols_map.get("price_eth") or cols_map.get("price_usd") or cols_map.get("price") or cols_map.get("amount") or cols_map.get("value")
        # Resolve currency
        cur_col = cols_map.get("currency") or cols_map.get("token_symbol") or cols_map.get("symbol")
        # Resolve token_id
        token_col = cols_map.get("token_id") or cols_map.get("nft_id") or cols_map.get("item_id")
        # Resolve collection
        col_col = cols_map.get("collection_address") or cols_map.get("contract_address") or cols_map.get("collection")
        # Resolve label
        lbl_col = cols_map.get("is_wash_trade") or cols_map.get("is_fraud") or cols_map.get("label") or cols_map.get("is_laundering")

        transforms = []
        if tx_col:
            transforms.append(pl.col(tx_col).cast(pl.Utf8).alias("tx_id"))
        else:
            transforms.append(pl.int_range(0, pl.len()).cast(pl.Utf8).alias("tx_id"))

        if src_col:
            transforms.append(pl.col(src_col).cast(pl.Utf8).alias("src"))
        else:
            raise ValueError("CSV must contain a source/seller/from column")

        if dst_col:
            transforms.append(pl.col(dst_col).cast(pl.Utf8).alias("dst"))
        else:
            raise ValueError("CSV must contain a destination/buyer/to column")

        if amt_col:
            transforms.append(pl.col(amt_col).cast(pl.Float64, strict=False).fill_null(0.0).alias("amount"))
        else:
            transforms.append(pl.lit(0.0).alias("amount"))

        if cur_col:
            transforms.append(pl.col(cur_col).cast(pl.Utf8).fill_null("ETH").alias("currency"))
        else:
            transforms.append(pl.lit("ETH").alias("currency"))

        if token_col:
            transforms.append(pl.col(token_col).cast(pl.Utf8).alias("token_id"))
        else:
            transforms.append(pl.lit(None).cast(pl.Utf8).alias("token_id"))

        if col_col:
            transforms.append(pl.col(col_col).cast(pl.Utf8).alias("collection"))
        else:
            transforms.append(pl.lit(None).cast(pl.Utf8).alias("collection"))

        if lbl_col:
            transforms.append(pl.col(lbl_col).cast(pl.Int32, strict=False).fill_null(0).alias("label"))
        else:
            transforms.append(pl.lit(0).cast(pl.Int32).alias("label"))

        df = df.with_columns(transforms)

        # Handle ts
        if ts_col:
            if df[ts_col].dtype == pl.Utf8:
                try:
                    df = df.with_columns(
                        pl.col(ts_col).str.to_datetime(strict=False).dt.timestamp("ms").truediv(1000.0).alias("ts")
                    )
                except Exception:
                    df = df.with_columns(pl.col(ts_col).cast(pl.Float64, strict=False).alias("ts"))
            else:
                df = df.with_columns(pl.col(ts_col).cast(pl.Float64).alias("ts"))
        else:
            df = df.with_columns(pl.int_range(0, pl.len()).cast(pl.Float64).alias("ts"))

    # Select standard columns & sort by ts
    standard_cols = ["tx_id", "ts", "src", "dst", "amount", "currency", "token_id", "collection", "label"]
    df_std = df.select(standard_cols).sort("ts")

    # Compute metadata
    unique_wallets = set(df_std["src"].to_list()).union(set(df_std["dst"].to_list()))
    metadata = {
        "schema_type": schema_type,
        "row_count": len(df_std),
        "wallet_count": len(unique_wallets),
        "total_volume": float(df_std["amount"].sum() or 0.0),
        "currency": df_std["currency"][0] if len(df_std) > 0 and df_std["currency"][0] else "ETH",
        "start_time": float(df_std["ts"].min() or 0.0),
        "end_time": float(df_std["ts"].max() or 0.0)
    }

    return df_std, metadata
