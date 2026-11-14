"""Tracer, Scorer, Investigator, Narrator, and Verifier agents."""
from __future__ import annotations

import logging
from typing import Any
import polars as pl
from traceflow.agents.ingest_agent import IngestAgent
from traceflow.config import Config
from traceflow.detectors import Cluster, run_all_detectors
from traceflow.tracer import TraceFlow
from traceflow.features import build_feature_table
from traceflow.ranker import train_lightgbm, save_model
from traceflow.investigator import build_evidence
from traceflow.narrator import Narrator
from traceflow.verifier import Verifier, VerifierResult

logger = logging.getLogger(__name__)


class TracerAgent:
    def __init__(self, config: Config):
        self.config = config
        self.tracer = TraceFlow(config)

    def run(self, tx_df: pl.DataFrame) -> list[Cluster]:
        logger.info("[TracerAgent] Running typology detectors and TraceFlow...")
        standard_clusters = run_all_detectors(tx_df, self.config)
        tf_clusters = self.tracer.trace(tx_df)
        combined = standard_clusters + tf_clusters
        logger.info("[TracerAgent] Total candidate clusters: %d", len(combined))
        return combined


class ScorerAgent:
    def __init__(self, config: Config):
        self.config = config

    def score_and_rank(
        self, clusters: list[Cluster], tx_df: pl.DataFrame, model_path: str | None = None
    ) -> list[Cluster]:
        if not clusters:
            return []

        logger.info("[ScorerAgent] Building features for %d clusters...", len(clusters))
        feat_df = build_feature_table(clusters, tx_df)

        feature_cols = [
            "size", "duration_hours", "edge_count", "amount_total", "amount_mean", "amount_std",
            "max_in_degree", "max_out_degree", "fan_out_count", "cycle_count", "pass_through_count",
            "is_fan_out", "is_fan_in", "is_cycle", "is_pass_through",
            "mean_dwell_seconds", "mean_retention", "end_to_end_retention",
        ]

        import numpy as np
        X = np.nan_to_num(feat_df.select(feature_cols).to_numpy(), nan=0.0)
        y = feat_df["label"].to_numpy()

        if len(np.unique(y)) > 1:
            model = train_lightgbm(X, y, feature_names=feature_cols)
            if model_path:
                save_model(model, model_path)
            scores = model.predict(X)
        else:
            scores = np.linspace(0.85, 0.45, len(clusters))

        for idx, cluster in enumerate(clusters):
            cluster.risk_score = round(float(scores[idx]), 3)

        clusters.sort(key=lambda c: c.risk_score or 0.0, reverse=True)
        return clusters


class InvestigatorAgent:
    def __init__(self, config: Config):
        self.config = config

    def investigate(self, cluster: Cluster, tx_df: pl.DataFrame) -> dict[str, Any]:
        logger.info("[InvestigatorAgent] Investigating cluster %s...", cluster.cluster_id)
        return build_evidence(cluster, tx_df, self.config)


class NarratorAgent:
    def __init__(self):
        self.narrator = Narrator()

    def generate_report(self, evidence: dict[str, Any], use_llm: bool = False) -> dict[str, Any]:
        logger.info("[NarratorAgent] Generating STR report for %s...", evidence.get("cluster_id"))
        return self.narrator.generate(evidence, use_llm=use_llm)


class VerifierAgent:
    def __init__(self):
        self.verifier = Verifier()

    def verify(self, report_text: str, evidence: dict[str, Any]) -> VerifierResult:
        logger.info("[VerifierAgent] Verifying report...")
        return self.verifier.verify(report_text, evidence)
