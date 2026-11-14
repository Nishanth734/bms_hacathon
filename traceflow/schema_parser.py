"""
Unified schema parser for NFT and Banking transaction datasets.
Standardizes headers and extracts unified columns:
tx_id, ts, src, dst, amount, currency, token_id, collection, label.
"""
from pathlib import Path
from typing import Dict, Any, Tuple, Optional, List
import polars as pl
import re
from datetime import datetime

def _normalize_name(name: str) -> str:
    """Normalize column name by trimming, stripping BOM, lowercasing, and replacing punctuation with underscore."""
    clean = str(name).strip().lstrip('\ufeff').lower()
    clean = re.sub(r'[\s\.\-]+', '_', clean)
    return clean.strip('_')

def _find_col(col_map: Dict[str, str], candidates: List[str]) -> Optional[str]:
    """Find the original column name matching any of the candidate normalized names."""
    for cand in candidates:
        norm_cand = _normalize_name(cand)
        if norm_cand in col_map:
            return col_map[norm_cand]
    return None

def detect_schema_type(columns: list[str]) -> str:
    """Detect whether columns represent an NFT dataset or a Banking/AML dataset."""
    norm_cols = {_normalize_name(c) for c in columns}
    
    nft_indicators = {
        "token_id", "nft_id", "item_id", "token", "asset_id",
        "collection", "collection_address", "contract_address", "contract",
        "seller", "seller_address", "buyer", "buyer_address",
        "price_eth", "price_usd", "is_wash_trade"
    }
    banking_indicators = {
        "from_bank", "to_bank", "source_bank", "dest_bank",
        "account_1", "account_to", "is_laundering", "payment_format",
        "receiving_currency", "payment_currency", "amount_paid", "amount_received"
    }

    if any(ind in norm_cols for ind in nft_indicators):
        return "nft"
    if any(ind in norm_cols for ind in banking_indicators):
        return "banking"
    
    # Generic fallback: check if 'seller' or 'token' exists
    if any("seller" in c or "token" in c or "nft" in c for c in norm_cols):
        return "nft"
    return "banking"

def _parse_timestamp_val(val: Any) -> float:
    """Parse single timestamp value (numeric, ISO, slash, hyphen) to epoch seconds."""
    if val is None or val == "" or str(val).lower() in ("null", "none", "nan", "na"):
        return 0.0
    try:
        f = float(val)
        if f > 1e11:  # milliseconds
            return f / 1000.0
        return f
    except (ValueError, TypeError):
        pass

    val_str = str(val).strip().replace("Z", "+00:00")
    # Try ISO
    try:
        return datetime.fromisoformat(val_str).timestamp()
    except Exception:
        pass

    for fmt in [
        "%Y/%m/%d %H:%M", "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S",
        "%m/%d/%Y %H:%M", "%m/%d/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S",
        "%Y/%m/%d", "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"
    ]:
        try:
            return datetime.strptime(val_str, fmt).timestamp()
        except Exception:
            continue
    return 0.0

def _parse_amount_val(val: Any) -> float:
    """Parse amount/price value cleaning currency symbols, commas and spaces."""
    if val is None or val == "" or str(val).lower() in ("null", "none", "nan", "na"):
        return 0.0
    if isinstance(val, (int, float)):
        return max(0.0, float(val))
    s = str(val).strip()
    s_clean = re.sub(r"[^\d\.\-]", "", s)
    try:
        return max(0.0, float(s_clean))
    except Exception:
        return 0.0

def parse_transaction_file(file_path: Path | str) -> Tuple[pl.DataFrame, Dict[str, Any]]:
    """
    Parse a CSV file into a standardized Polars DataFrame.
    Returns (standardized_df, metadata_dict).
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")

    # Check file size
    if path.stat().st_size == 0:
        raise ValueError("The uploaded CSV file is empty (0 bytes). Please provide a CSV with transaction records.")

    # Read CSV with encoding fallbacks and csv.reader fallback
    raw_df = None
    read_err = None
    for enc in ["utf8", "utf8-lossy"]:
        try:
            raw_df = pl.read_csv(
                path,
                encoding=enc,
                null_values=["", "NA", "null", "NULL", "NaN", "nan"],
                ignore_errors=True,
                infer_schema_length=5000,
                truncate_ragged_lines=True,
            )
            break
        except Exception as e:
            read_err = e

    if raw_df is None:
        # Fallback to standard Python csv reader
        import csv
        try:
            with open(path, "r", encoding="utf-8-sig", errors="replace") as f:
                reader = csv.reader(f)
                rows = [r for r in reader if any(field.strip() for field in r)]
            if rows:
                headers = [h.strip() for h in rows[0]]
                data = rows[1:]
                col_data = {h: [r[i] if i < len(r) else None for r in data] for i, h in enumerate(headers)}
                raw_df = pl.DataFrame(col_data)
        except Exception as e2:
            raise ValueError(f"Unable to read CSV file: {read_err or e2 or 'Corrupted file format'}")

    if raw_df is None:
        raise ValueError(f"Unable to read CSV file: {read_err or 'Corrupted file format'}")

    if raw_df.height == 0:
        raise ValueError("The uploaded CSV file contains headers but no transaction records.")

    # Build normalized header lookup map
    # norm_map[normalized_name] = original_name
    col_map: Dict[str, str] = {}
    for c in raw_df.columns:
        norm_key = _normalize_name(c)
        if norm_key not in col_map:
            col_map[norm_key] = c

    schema_type = detect_schema_type(raw_df.columns)

    # 1. Resolve Source (Sender / Seller / Source Bank + Account)
    from_bank_col = _find_col(col_map, ["from_bank", "source_bank", "sending_bank", "bank_from", "origin_bank", "from_institution"])
    from_acc_col = _find_col(col_map, ["from_account", "account", "source_account", "account_from", "sending_account", "origin_account", "from_acc"])
    direct_src_col = _find_col(col_map, [
        "seller_address", "seller", "seller_wallet", "from_address", "from_addr",
        "from", "src", "source", "sender", "sender_address", "origin", "origin_address",
        "source_account", "from_account", "account_from"
    ])

    # 2. Resolve Destination (Receiver / Buyer / Target Bank + Account)
    to_bank_col = _find_col(col_map, ["to_bank", "dest_bank", "destination_bank", "receiving_bank", "target_bank", "bank_to", "to_institution"])
    to_acc_col = _find_col(col_map, ["to_account", "account_1", "account1", "dest_account", "destination_account", "receiving_account", "target_account", "account_to", "to_acc"])
    direct_dst_col = _find_col(col_map, [
        "buyer_address", "buyer", "buyer_wallet", "to_address", "to_addr",
        "to", "dst", "destination", "receiver", "receiver_address", "recipient",
        "recipient_address", "target", "target_account", "to_account", "account_to"
    ])

    # 3. Resolve Amount / Price
    amt_col = _find_col(col_map, [
        "amount", "price_eth", "price_usd", "price", "amount_paid", "amount_received",
        "value", "paid_amount", "payment_amount", "transferred_amount", "sum", "volume"
    ])

    # 4. Resolve Timestamp / Date
    ts_col = _find_col(col_map, [
        "timestamp", "time", "date", "datetime", "block_timestamp", "tx_time",
        "txn_time", "block_time", "created_at", "trans_date", "transaction_date"
    ])

    # 5. Resolve Tx ID / Hash
    tx_col = _find_col(col_map, [
        "tx_hash", "transaction_hash", "tx_id", "hash", "id", "txid", "txn_hash",
        "transaction_id", "reference_number", "trans_id"
    ])

    # 6. Resolve Currency
    cur_col = _find_col(col_map, [
        "currency", "payment_currency", "receiving_currency", "token_symbol",
        "symbol", "coin", "asset", "unit"
    ])

    # 7. Resolve Token ID (NFT)
    token_col = _find_col(col_map, [
        "token_id", "token", "nft_id", "item_id", "asset_id", "token_number", "id_token"
    ])

    # 8. Resolve Collection (NFT)
    col_col = _find_col(col_map, [
        "collection_address", "collection", "contract_address", "contract", "nft_contract", "smart_contract"
    ])

    # 9. Resolve Label
    lbl_col = _find_col(col_map, [
        "is_wash_trade", "is_laundering", "is_fraud", "label", "fraud_label",
        "is_suspicious", "fraud", "illicit", "target_label"
    ])

    # Validate source and destination resolution
    has_banking_src = from_bank_col and from_acc_col
    has_banking_dst = to_bank_col and to_acc_col

    if not has_banking_src and not direct_src_col:
        raise ValueError(
            f"Missing required sender/source column in CSV. Looked for ['seller_address', 'from', 'src', 'From Bank'+'Account', ...]. Found columns: {list(raw_df.columns)}"
        )

    if not has_banking_dst and not direct_dst_col:
        raise ValueError(
            f"Missing required recipient/destination column in CSV. Looked for ['buyer_address', 'to', 'dst', 'To Bank'+'Account.1', ...]. Found columns: {list(raw_df.columns)}"
        )

    # Build standardized columns
    # A. Source
    if has_banking_src:
        src_series = (
            raw_df[from_bank_col].cast(pl.Utf8).fill_null("Bank")
            + "_"
            + raw_df[from_acc_col].cast(pl.Utf8).fill_null("0000")
        )
    else:
        src_series = raw_df[direct_src_col].cast(pl.Utf8).fill_null("unknown_src")

    # B. Destination
    if has_banking_dst:
        dst_series = (
            raw_df[to_bank_col].cast(pl.Utf8).fill_null("Bank")
            + "_"
            + raw_df[to_acc_col].cast(pl.Utf8).fill_null("0000")
        )
    else:
        dst_series = raw_df[direct_dst_col].cast(pl.Utf8).fill_null("unknown_dst")

    # C. Tx ID
    if tx_col:
        tx_series = raw_df[tx_col].cast(pl.Utf8).fill_null(
            pl.Series([f"tx_{i}" for i in range(raw_df.height)])
        )
    else:
        tx_series = pl.Series("tx_id", [f"tx_{i}" for i in range(raw_df.height)])

    # D. Amount
    if amt_col:
        raw_amounts = raw_df[amt_col].to_list()
        cleaned_amounts = [_parse_amount_val(v) for v in raw_amounts]
        amount_series = pl.Series("amount", cleaned_amounts, dtype=pl.Float64)
    else:
        amount_series = pl.Series("amount", [1.0] * raw_df.height, dtype=pl.Float64)

    # E. Timestamp
    if ts_col:
        raw_ts = raw_df[ts_col].to_list()
        cleaned_ts = [_parse_timestamp_val(v) for v in raw_ts]
        # If any parsed to 0.0, synthesize sequential timestamps preserving order
        all_zero = all(t == 0.0 for t in cleaned_ts)
        if all_zero:
            cleaned_ts = [float(1700000000 + i * 60) for i in range(raw_df.height)]
        ts_series = pl.Series("ts", cleaned_ts, dtype=pl.Float64)
    else:
        ts_series = pl.Series("ts", [float(1700000000 + i * 60) for i in range(raw_df.height)], dtype=pl.Float64)

    # F. Currency
    default_curr = "USD" if schema_type == "banking" else "ETH"
    if cur_col:
        cur_series = raw_df[cur_col].cast(pl.Utf8).fill_null(default_curr)
    else:
        cur_series = pl.Series("currency", [default_curr] * raw_df.height, dtype=pl.Utf8)

    # G. Token ID (NFT only)
    if token_col:
        token_series = raw_df[token_col].cast(pl.Utf8)
    else:
        token_series = pl.Series("token_id", [None] * raw_df.height, dtype=pl.Utf8)

    # H. Collection (NFT only)
    if col_col:
        col_series = raw_df[col_col].cast(pl.Utf8)
    else:
        col_series = pl.Series("collection", [None] * raw_df.height, dtype=pl.Utf8)

    # I. Label
    if lbl_col:
        raw_lbls = raw_df[lbl_col].to_list()
        cleaned_lbls = []
        for l in raw_lbls:
            try:
                cleaned_lbls.append(int(float(l)))
            except Exception:
                cleaned_lbls.append(0)
        label_series = pl.Series("label", cleaned_lbls, dtype=pl.Int32)
    else:
        label_series = pl.Series("label", [0] * raw_df.height, dtype=pl.Int32)

    # Construct unified dataframe
    df_std = pl.DataFrame([
        tx_series.alias("tx_id"),
        ts_series.alias("ts"),
        src_series.alias("src"),
        dst_series.alias("dst"),
        amount_series.alias("amount"),
        cur_series.alias("currency"),
        token_series.alias("token_id"),
        col_series.alias("collection"),
        label_series.alias("label"),
    ])

    # Filter out empty src or dst (if any)
    df_std = df_std.filter(
        (pl.col("src").is_not_null()) & (pl.col("src") != "") &
        (pl.col("dst").is_not_null()) & (pl.col("dst") != "")
    )

    if df_std.height == 0:
        raise ValueError("No valid transaction rows found after filtering empty sender or receiver accounts.")

    # Deduplicate exact duplicate tx_id if any
    df_std = df_std.unique(subset=["tx_id"], keep="first")

    # Sort strictly by timestamp
    df_std = df_std.sort("ts")

    # Compute metadata
    unique_wallets = set(df_std["src"].to_list()).union(set(df_std["dst"].to_list()))
    first_curr = df_std["currency"][0] if len(df_std) > 0 and df_std["currency"][0] else default_curr

    metadata = {
        "schema_type": schema_type,
        "row_count": len(df_std),
        "wallet_count": len(unique_wallets),
        "total_volume": float(df_std["amount"].sum() or 0.0),
        "currency": first_curr,
        "start_time": float(df_std["ts"].min() or 0.0),
        "end_time": float(df_std["ts"].max() or 0.0)
    }

    return df_std, metadata
