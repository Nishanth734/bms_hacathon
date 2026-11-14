"""Script to execute the 4-way ablation benchmark and print results."""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from traceflow.ablation import run_ablation
from traceflow.config import get_config
from traceflow.loader import load_csv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("run_ablation")


def main():
    parser = argparse.ArgumentParser(description="Run 4-way Ablation")
    parser.add_argument("--csv", type=str, default=None, help="Path to input CSV")
    parser.add_argument("--out", type=str, default="results", help="Output directory")
    args = parser.parse_args()

    config = get_config()
    if args.out:
        config.RESULTS_DIR = args.out

    csv_path = args.csv or config.IBM_CSV_PATH
    logger.info("Loading data from %s...", csv_path)
    tx_df = load_csv(csv_path)

    logger.info("Running four-way ablation...")
    results = run_ablation(tx_df, config)

    # Print table formatted nicely
    header = f"{'Method':<25} {'Precision':<10} {'Recall':<10} {'F1':<10} {'PR-AUC':<10} {'P@K':<10} {'Alerts/Day':<12}"
    print("\n" + "=" * 90)
    print("TRACEFLOW ABLATION BENCHMARK (CHRONOLOGICAL SPLIT)")
    print("=" * 90)
    print(header)
    print("-" * 90)
    for r in results:
        print(
            f"{r['label']:<25} "
            f"{r['precision']:<10.4f} "
            f"{r['recall']:<10.4f} "
            f"{r['f1']:<10.4f} "
            f"{r['pr_auc']:<10.4f} "
            f"{r['precision_at_k']:<10.4f} "
            f"{r['false_alerts_per_day']:<12.1f}"
        )
    print("=" * 90 + "\n")


if __name__ == "__main__":
    main()
