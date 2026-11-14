"""Pipeline runner script for TraceFlow AML."""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import polars as pl

from traceflow.agents import IngestAgent, InvestigatorAgent, NarratorAgent, ScorerAgent, TracerAgent
from traceflow.config import get_config
from traceflow.ranker import chronological_split, compute_metrics, threshold_baseline

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("run_pipeline")


def main():
    parser = argparse.ArgumentParser(description="Run TraceFlow Pipeline")
    parser.add_argument("--mode", choices=["baseline", "full"], default="full", help="Pipeline execution mode")
    parser.add_argument("--csv", type=str, default=None, help="Path to input CSV")
    parser.add_argument("--out", type=str, default="results", help="Output directory")
    parser.add_argument("--top-cases", type=int, default=20, help="Number of top cases to generate evidence/reports for")
    parser.add_argument("--with-learning", action="store_true", help="Execute the learning loop demonstration and safety gate evaluation")
    args = parser.parse_args()

    config = get_config()
    if args.out:
        config.RESULTS_DIR = args.out
    out_dir = Path(config.RESULTS_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)

    csv_path = args.csv or config.IBM_CSV_PATH

    logger.info("Starting pipeline in mode: %s on %s", args.mode, csv_path)

    ingest = IngestAgent()
    tx_df = ingest.run(csv_path, out_parquet=str(out_dir / "transactions.parquet"))

    if args.mode == "baseline":
        logger.info("Running baseline evaluation...")
        _, _, test_df = chronological_split(tx_df, config.TRAIN_SPLIT, config.VAL_SPLIT)
        y_test = test_df["label"].to_numpy()
        y_pred = threshold_baseline(test_df, config.AMOUNT_THRESHOLD_BASELINE)
        y_scores = test_df["amount"].to_numpy() / max(1.0, test_df["amount"].max())

        n_days = max(1.0, (test_df["ts"].max() - test_df["ts"].min()) / 86400.0) if not test_df.is_empty() else 1.0
        metrics = compute_metrics(y_test, y_pred, y_scores, k=config.PRECISION_AT_K, n_days=n_days)
        metrics["method"] = "A_threshold"
        metrics["label"] = "Threshold Baseline"

        out_metrics = out_dir / "baseline_metrics.json"
        with open(out_metrics, "w", encoding="utf-8") as f:
            json.dump(metrics, f, indent=2)
        logger.info("Baseline metrics: %s", metrics)
        return

    # Full mode
    tracer_agent = TracerAgent(config)
    candidate_clusters = tracer_agent.run(tx_df)

    scorer_agent = ScorerAgent(config)
    ranked_clusters = scorer_agent.score_and_rank(
        candidate_clusters, tx_df, model_path=str(Path(config.MODELS_DIR) / "lightgbm_ranker.txt")
    )

    # Save clusters to parquet
    cluster_dicts = [
        {
            "cluster_id": c.cluster_id,
            "typology": c.typology,
            "primary_typology": c.primary_typology,
            "risk_score": c.risk_score or 0.0,
            "size": c.size,
            "duration_hours": c.duration_hours,
            "start_time": str(c.start_time),
            "end_time": str(c.end_time),
            "accounts": c.accounts,
            "edge_ids": c.edge_ids,
            "dwell": c.dwell or {},
            "retention": c.retention or {},
            "end_to_end_retention": c.end_to_end_retention,
            "label": c.label or 0,
        }
        for c in ranked_clusters
    ]

    if cluster_dicts:
        clusters_df = pl.DataFrame(cluster_dicts)
        clusters_df.write_parquet(out_dir / "clusters.parquet")
        logger.info("Saved %d clusters to %s", len(ranked_clusters), out_dir / "clusters.parquet")

    # Generate evidence and reports for top cases
    investigator = InvestigatorAgent(config)
    narrator = NarratorAgent()

    top_clusters = ranked_clusters[: args.top_cases]
    logger.info("Generating evidence and reports for top %d clusters...", len(top_clusters))
    for c in top_clusters:
        evidence = investigator.investigate(c, tx_df)
        report = narrator.generate_report(evidence)
        # Store report inside evidence JSON for easy UI consumption
        evidence["report"] = report
        with open(out_dir / "evidence" / f"{c.cluster_id}.json", "w", encoding="utf-8") as f:
            json.dump(evidence, f, indent=2)

    logger.info("Pipeline completed successfully!")

    if args.with_learning:
        logger.info("Triggering Learning Loop evaluation (--with-learning)...")
        from scripts.demo_learning import run_demo
        run_demo()


if __name__ == "__main__":
    main()
