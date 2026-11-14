"""Tests for traceflow.features and traceflow.ranker."""
import numpy as np
from traceflow.features import build_feature_row, build_feature_table
from traceflow.ranker import (
    chronological_split,
    threshold_baseline,
    compute_metrics,
    train_lightgbm,
    save_model,
    load_model,
)

def test_feature_row_all_columns(sample_cluster, tiny_df):
    row = build_feature_row(sample_cluster, tiny_df)
    expected_cols = [
        "cluster_id", "size", "duration_hours", "edge_count", "amount_total",
        "amount_mean", "amount_std", "max_in_degree", "max_out_degree",
        "fan_out_count", "cycle_count", "pass_through_count",
        "mean_dwell_seconds", "mean_retention", "end_to_end_retention",
        "is_fan_out", "is_fan_in", "is_cycle", "is_pass_through", "label"
    ]
    for col in expected_cols:
        assert col in row

def test_chronological_split_proportions(tiny_df):
    tr, val, te = chronological_split(tiny_df, 0.6, 0.2)
    assert len(tr) + len(val) + len(te) == len(tiny_df)
    assert tr["ts"].max() <= val["ts"].min()
    assert val["ts"].max() <= te["ts"].min()

def test_threshold_baseline_flags_above(tiny_df):
    flags = threshold_baseline(tiny_df, 15000.0)
    for i, flag in enumerate(flags):
        if tiny_df["amount"][i] >= 15000.0:
            assert flag == 1
        else:
            assert flag == 0

def test_metrics_perfect_predictor():
    y_true = np.array([1, 0, 1, 0, 1])
    y_pred = np.array([1, 0, 1, 0, 1])
    y_score = np.array([0.9, 0.1, 0.8, 0.2, 0.95])
    m = compute_metrics(y_true, y_pred, y_score)
    assert m["precision"] == 1.0
    assert m["recall"] == 1.0
    assert m["f1"] == 1.0
    assert m["pr_auc"] >= 0.99

def test_lightgbm_train_and_save(tmp_path):
    X = np.random.randn(20, 5)
    y = np.array([1]*5 + [0]*15)
    model = train_lightgbm(X, y)
    scores = model.predict(X)
    assert len(scores) == 20
    assert (scores >= 0).all() and (scores <= 1).all()

    p = tmp_path / "model.txt"
    save_model(model, str(p))
    loaded = load_model(str(p))
    loaded_scores = loaded.predict(X)
    np.testing.assert_allclose(scores, loaded_scores)
