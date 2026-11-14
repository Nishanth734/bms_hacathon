"""Ranking and evaluation harness for TraceFlow."""
from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import Any

import joblib
import lightgbm as lgb
import numpy as np
import polars as pl
from sklearn.metrics import average_precision_score, f1_score, precision_score, recall_score

logger = logging.getLogger(__name__)


def chronological_split(
    tx_df: pl.DataFrame, train_frac: float = 0.6, val_frac: float = 0.2
) -> tuple[pl.DataFrame, pl.DataFrame, pl.DataFrame]:
    """Split time-sorted DataFrame chronologically into train, val, and test partitions."""
    df_sorted = tx_df.sort("ts")
    n = len(df_sorted)
    n_train = int(n * train_frac)
    n_val = int(n * val_frac)

    train_df = df_sorted.slice(0, n_train)
    val_df = df_sorted.slice(n_train, n_val)
    test_df = df_sorted.slice(n_train + n_val)

    return train_df, val_df, test_df


def threshold_baseline(tx_df: pl.DataFrame, threshold: float) -> np.ndarray:
    """Simple baseline: flags any transaction with amount >= threshold."""
    return (tx_df["amount"] >= threshold).cast(pl.Int8).to_numpy()


def compute_metrics(
    y_true: np.ndarray,
    y_pred_binary: np.ndarray,
    y_pred_score: np.ndarray | None = None,
    k: int = 20,
    n_days: float | None = None,
) -> dict[str, float]:
    """Compute standard AML metrics: precision, recall, F1, PR-AUC, precision@k, false_alerts/day."""
    y_true = np.asarray(y_true, dtype=int)
    y_pred_binary = np.asarray(y_pred_binary, dtype=int)

    # Precision, Recall, F1
    prec = float(precision_score(y_true, y_pred_binary, zero_division=0))
    rec = float(recall_score(y_true, y_pred_binary, zero_division=0))
    f1 = float(f1_score(y_true, y_pred_binary, zero_division=0))

    # PR-AUC
    if y_pred_score is not None and len(np.unique(y_true)) > 1:
        try:
            pr_auc = float(average_precision_score(y_true, y_pred_score))
        except Exception:
            pr_auc = 0.0
    else:
        pr_auc = float(prec) if prec > 0 else 0.0

    # Precision @ k
    if y_pred_score is not None and len(y_pred_score) > 0:
        actual_k = min(k, len(y_pred_score))
        top_k_indices = np.argsort(y_pred_score)[::-1][:actual_k]
        prec_at_k = float(np.mean(y_true[top_k_indices])) if actual_k > 0 else 0.0
    else:
        actual_k = min(k, len(y_pred_binary))
        top_k_indices = np.argsort(y_pred_binary)[::-1][:actual_k]
        prec_at_k = float(np.mean(y_true[top_k_indices])) if actual_k > 0 else 0.0

    # False alerts per day
    fps = np.sum((y_pred_binary == 1) & (y_true == 0))
    if n_days and n_days > 0:
        false_alerts_per_day = float(fps / n_days)
    else:
        false_alerts_per_day = float(fps)

    return {
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "pr_auc": round(pr_auc, 4),
        "precision_at_k": round(prec_at_k, 4),
        "false_alerts_per_day": round(false_alerts_per_day, 2),
    }


def train_lightgbm(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray | None = None,
    y_val: np.ndarray | None = None,
    feature_names: list[str] | None = None,
    scale_pos_weight: float | None = None,
    sample_weight: np.ndarray | None = None,
) -> lgb.Booster:
    """Train a LightGBM classifier with class imbalance weighting."""
    if len(np.unique(y_train)) < 2:
        dummy_x = np.zeros((1, X_train.shape[1]))
        dummy_y = np.array([0 if y_train[0] == 1 else 1])
        X_train = np.vstack([X_train, dummy_x])
        y_train = np.concatenate([y_train, dummy_y])
        if sample_weight is not None:
            sample_weight = np.concatenate([sample_weight, [1.0]])

    if scale_pos_weight is None:
        n_pos = np.sum(y_train == 1)
        n_neg = np.sum(y_train == 0)
        scale_pos_weight = max(1.0, float(n_neg / max(1, n_pos)))

    params = {
        "objective": "binary",
        "metric": "binary_logloss",
        "boosting_type": "gbdt",
        "scale_pos_weight": scale_pos_weight,
        "learning_rate": 0.05,
        "num_leaves": 31,
        "verbose": -1,
        "seed": 42,
    }

    train_data = lgb.Dataset(X_train, label=y_train, weight=sample_weight, feature_name=feature_names)
    valid_sets = [train_data]
    if X_val is not None and y_val is not None and len(y_val) > 0:
        val_data = lgb.Dataset(X_val, label=y_val, feature_name=feature_names, reference=train_data)
        valid_sets.append(val_data)

    model = lgb.train(
        params,
        train_data,
        num_boost_round=100,
        valid_sets=valid_sets,
    )

    return model


def save_model(model: lgb.Booster, path: str) -> None:
    """Save model to disk."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(str(p))


def load_model(path: str) -> lgb.Booster:
    """Load model from disk."""
    return lgb.Booster(model_file=str(path))
