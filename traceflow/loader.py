"""IBM HI-Small CSV loader for TraceFlow."""
from __future__ import annotations

import argparse
import logging
from pathlib import Path

import polars as pl

logger = logging.getLogger(__name__)

# Exact columns as they appear in the IBM HI-Small dataset
_IBM_COLUMNS = [
    "Timestamp",
    "From Bank",
    "Account",
    "To Bank",
    "Account.1",
    "Amount Received",
    "Receiving Currency",
    "Amount Paid",
    "Payment Currency",
    "Payment Format",
    "Is Laundering",
]


class SchemaError(Exception):
    """Raised when the CSV does not match the expected IBM HI-Small schema."""


def load_csv(path: str, out_parquet: str | None = None) -> pl.DataFrame:
    """Load IBM HI-Small CSV and return a normalised Polars DataFrame.

    Columns returned: tx_id, ts, src, dst, amount, currency, label, payment_format.
    """
    path = str(path)
    logger.info("Loading CSV: %s", path)

    try:
        raw = pl.read_csv(
            path,
            infer_schema_length=10_000,
            try_parse_dates=False,
            ignore_errors=False,
        )
    except Exception as exc:
        raise SchemaError(f"Failed to read CSV '{path}': {exc}") from exc

    # --- Schema validation ---
    missing = [c for c in _IBM_COLUMNS if c not in raw.columns]
    if missing:
        raise SchemaError(
            f"Missing expected columns: {missing}. "
            f"Expected: {_IBM_COLUMNS}. Found: {raw.columns}"
        )

    # --- Build tx_id ---
    raw = raw.with_row_index(name="_row_idx").with_columns(
        pl.col("_row_idx").cast(pl.Utf8).alias("tx_id")
    ).drop("_row_idx")

    # --- Parse timestamp ---
    # IBM format: "2022/09/01 00:00" or similar; try numeric fallback
    if raw["Timestamp"].dtype == pl.Utf8:
        # Try parsing as datetime string; fall back to seconds-since-epoch
        try:
            raw = raw.with_columns(
                pl.col("Timestamp")
                .str.to_datetime(format="%Y/%m/%d %H:%M", strict=False)
                .alias("ts_dt")
            )
            raw = raw.with_columns(
                (pl.col("ts_dt").dt.epoch(time_unit="s").cast(pl.Float64)).alias("ts")
            ).drop("ts_dt")
        except Exception:
            raw = raw.with_columns(
                pl.col("Timestamp").cast(pl.Float64).alias("ts")
            )
    else:
        raw = raw.with_columns(
            pl.col("Timestamp").cast(pl.Float64).alias("ts")
        )

    # --- Build src / dst composite keys ---
    raw = raw.with_columns(
        (
            pl.col("From Bank").cast(pl.Utf8)
            + "_"
            + pl.col("Account").cast(pl.Utf8)
        ).alias("src"),
        (
            pl.col("To Bank").cast(pl.Utf8)
            + "_"
            + pl.col("Account.1").cast(pl.Utf8)
        ).alias("dst"),
    )

    # --- Rename and select ---
    df = raw.rename(
        {
            "Amount Received": "amount",
            "Receiving Currency": "currency",
            "Is Laundering": "label",
            "Payment Format": "payment_format",
        }
    ).select(
        [
            "tx_id",
            "ts",
            "src",
            "dst",
            pl.col("amount").cast(pl.Float64),
            "currency",
            pl.col("label").cast(pl.Int32),
            "payment_format",
        ]
    )

    # --- Sort by ts ---
    df = df.sort("ts")

    validate_schema(df)

    logger.info("Loaded %d transactions", len(df))

    if out_parquet:
        out_path = Path(out_parquet)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        df.write_parquet(str(out_path))
        logger.info("Saved parquet: %s", out_parquet)

    return df


def validate_schema(df: pl.DataFrame) -> None:
    """Check required columns exist and no nulls in critical fields."""
    required = ["tx_id", "ts", "src", "dst", "amount", "currency", "label"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise SchemaError(f"Output DataFrame missing columns: {missing}")

    for col in required:
        null_count = df[col].null_count()
        if null_count > 0:
            raise SchemaError(f"Column '{col}' has {null_count} null values")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load IBM HI-Small CSV")
    parser.add_argument("--csv", required=True, help="Path to HI-Small CSV")
    parser.add_argument("--out", default=None, help="Output parquet path")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    df = load_csv(args.csv, args.out)
    print(df.head())
    print(f"Shape: {df.shape}")
