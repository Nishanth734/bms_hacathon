"""Ingest agent for validating and preparing transaction data."""
from __future__ import annotations

import logging
import polars as pl
from traceflow.loader import load_csv, validate_schema
from traceflow.graph_builder import build_edge_arrays

logger = logging.getLogger(__name__)

class IngestAgent:
    def run(self, csv_path: str, out_parquet: str | None = None) -> pl.DataFrame:
        logger.info("[IngestAgent] Loading CSV from %s", csv_path)
        df = load_csv(csv_path, out_parquet=out_parquet)
        validate_schema(df)
        logger.info("[IngestAgent] Loaded %d transactions", len(df))
        return df
