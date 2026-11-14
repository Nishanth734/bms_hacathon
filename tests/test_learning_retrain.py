"""
Unit tests for TraceFlow Safe Retraining & Model Registry.
Tests:
- Gate passes when candidate is equal or better
- Gate rejects a candidate with degraded metrics
- Sample weights are capped at max_case_weight_share (20%)
- Rollback successfully restores old model and rescores scores.parquet
"""
import json
import os
import shutil
from pathlib import Path
import pytest
import lightgbm as lgb
import numpy as np
import polars as pl

from traceflow.learning.case_store import add_case, approve
from traceflow.learning.retrain import (
    FEATURE_COLS,
    ensure_base_dataset,
    retrain,
    rollback,
    list_models,
)
import traceflow.learning.retrain as retrain_module


@pytest.fixture(autouse=True)
def setup_test_env(tmp_path, monkeypatch):
    """Isolate files in tmp_path for each test."""
    test_models = tmp_path / "models"
    test_data = tmp_path / "data"
    test_models.mkdir()
    test_data.mkdir()

    test_features = test_data / "features.parquet"
    test_splits = test_data / "splits.json"
    test_scores = test_data / "scores.parquet"
    test_case_store = test_data / "case_store.parquet"
    test_case_log = test_data / "case_store_log.csv"
    test_case_feats = test_data / "case_store_features.parquet"
    test_retrain_log = test_data / "retrain_log.csv"

    test_versions = test_models / "versions"
    test_versions.mkdir()
    test_ranker = test_models / "ranker.txt"
    test_registry = test_models / "registry.json"

    monkeypatch.setattr(retrain_module, "MODELS_DIR", test_models)
    monkeypatch.setattr(retrain_module, "VERSIONS_DIR", test_versions)
    monkeypatch.setattr(retrain_module, "RANKER_PATH", test_ranker)
    monkeypatch.setattr(retrain_module, "REGISTRY_PATH", test_registry)
    monkeypatch.setattr(retrain_module, "FEATURES_PATH", test_features)
    monkeypatch.setattr(retrain_module, "SPLITS_PATH", test_splits)
    monkeypatch.setattr(retrain_module, "SCORES_PATH", test_scores)
    monkeypatch.setattr(retrain_module, "RETRAIN_LOG_PATH", test_retrain_log)
    monkeypatch.setattr(retrain_module, "CASE_STORE_FEATURES_PATH", test_case_feats)

    # Monkeypatch case store paths
    monkeypatch.setattr("traceflow.learning.case_store.CASE_STORE_PATH", test_case_store)
    monkeypatch.setattr("traceflow.learning.case_store.CASE_STORE_LOG_PATH", test_case_log)

    # Generate synthetic features & splits
    np.random.seed(42)
    rows = []
    for i in range(80):
        # 0 or 1 label
        lbl = 1 if i % 4 == 0 else 0
        r = {col: float(np.random.uniform(1.0, 100.0)) for col in FEATURE_COLS}
        r["cluster_id"] = f"c_{i:04d}"
        r["cluster_label"] = lbl
        rows.append(r)

    n_train = 50
    n_val = 15
    train_ids = [rows[i]["cluster_id"] for i in range(0, n_train)]
    val_ids = [rows[i]["cluster_id"] for i in range(n_train, n_train + n_val)]
    test_ids = [rows[i]["cluster_id"] for i in range(n_train + n_val, len(rows))]

    splits = {"train": train_ids, "val": val_ids, "test": test_ids}
    for r in rows:
        if r["cluster_id"] in train_ids:
            r["split"] = "train"
        elif r["cluster_id"] in val_ids:
            r["split"] = "val"
        else:
            r["split"] = "test"

    df = pl.DataFrame(rows)
    df.write_parquet(str(test_features))
    with open(test_splits, "w", encoding="utf-8") as f:
        json.dump(splits, f)

    # Train and save initial baseline ranker_v1
    X_train = df.filter(pl.col("cluster_id").is_in(train_ids)).select(FEATURE_COLS).to_numpy()
    y_train = df.filter(pl.col("cluster_id").is_in(train_ids)).select("cluster_label").to_numpy().ravel()

    train_data = lgb.Dataset(X_train, label=y_train, feature_name=FEATURE_COLS)
    init_model = lgb.train({"objective": "binary", "verbose": -1, "seed": 42}, train_data, num_boost_round=10)
    init_model.save_model(str(test_ranker))
    init_model.save_model(str(test_versions / "ranker_v1.txt"))

    with open(test_registry, "w", encoding="utf-8") as f:
        json.dump({
            "active_version": 1,
            "history": [{
                "version": 1,
                "timestamp": "2026-11-14T10:00:00Z",
                "pr_auc": 0.85,
                "f1": 0.80,
                "approved_cases_count": 0,
                "gate_passed": True,
                "promoted": True,
                "promoted_at": "2026-11-14T10:00:00Z",
            }],
        }, f)

    yield


def test_01_gate_passes_when_candidate_is_equal_or_better():
    """Verify that retrain promotes candidate when metrics meet safety gate."""
    # Add 5 approved cases
    for i in range(5):
        cid = f"c_{i:04d}"
        add_case(case_id=f"case_{i}", cluster_id=cid, typology="cycle", label=1, source="analyst", status="approved", approved_by="Analyst_1")

    res = retrain(force=False)
    assert res["promoted"] is True
    assert res["gate_passed"] is True
    assert res["version"] == 2
    assert res["approved_cases_count"] == 5

    # Check models/ranker.txt was updated and scores.parquet rescored
    models_info = list_models()
    assert models_info["active_version"] == 2
    assert retrain_module.SCORES_PATH.exists()
    scores_df = pl.read_parquet(str(retrain_module.SCORES_PATH))
    assert scores_df.height == 80
    assert "score" in scores_df.columns
    assert "rank" in scores_df.columns
    assert scores_df["rank"].to_list() == list(range(1, 81))


def test_02_gate_rejects_degraded_candidate(monkeypatch):
    """Verify safety gate blocks candidate when validation metric drop exceeds threshold."""
    for i in range(5):
        cid = f"c_{i:04d}"
        add_case(case_id=f"case_{i}", cluster_id=cid, typology="cycle", label=1, source="analyst", status="approved", approved_by="Analyst_1")

    # Create dummy candidate booster that outputs inverted/terrible predictions
    original_train = lgb.train
    def mock_bad_train(*args, **kwargs):
        # Create a mock booster with predictable poor scores
        class BadBooster:
            def predict(self, X):
                # Invert logic: predict 0.0 for illicit, 1.0 for normal to tank PR-AUC and F1
                return np.zeros(len(X), dtype=float)
            def save_model(self, path):
                Path(path).write_text("bad_model")
        return BadBooster()

    monkeypatch.setattr("traceflow.learning.retrain.train_lightgbm", mock_bad_train)

    res = retrain(force=True)
    assert res["promoted"] is False
    assert res["gate_passed"] is False
    assert "Metric drop on frozen validation set exceeds" in res["reason"]

    # Active ranker must NOT have changed from version 1
    models_info = list_models()
    assert models_info["active_version"] == 1


def test_03_sample_weights_capped_at_max_case_weight_share(monkeypatch):
    """Verify approved case weights never exceed max_case_weight_share (default 0.20)."""
    # Add 25 approved cases (with case_weight=5.0 each, 25*5 = 125, which would exceed 20% of 50 base samples)
    for i in range(25):
        cid = f"c_{i:04d}"
        add_case(case_id=f"case_{i}", cluster_id=cid, typology="cycle", label=1, source="analyst", status="approved", approved_by="Analyst_1")

    captured_weights = []
    def mock_train_lightgbm(X_train, y_train, X_val=None, y_val=None, feature_names=None, scale_pos_weight=None):
        # We need to capture sample weights passed into Dataset
        # Return a standard trained model
        train_data = lgb.Dataset(X_train, label=y_train, feature_name=feature_names)
        return lgb.train({"objective": "binary", "verbose": -1, "seed": 42}, train_data, num_boost_round=5)

    # Wrap lgb.Dataset to capture weights
    orig_dataset_init = lgb.Dataset.__init__
    def mock_dataset_init(self, data, label=None, reference=None, weight=None, **kwargs):
        if weight is not None:
            captured_weights.append(list(weight))
        orig_dataset_init(self, data, label=label, reference=reference, weight=weight, **kwargs)

    monkeypatch.setattr(lgb.Dataset, "__init__", mock_dataset_init)

    retrain(force=True)
    assert len(captured_weights) > 0
    weights = np.array(captured_weights[0])
    base_weights = weights[:50]
    approved_weights = weights[50:]

    base_sum = float(np.sum(base_weights))
    approved_sum = float(np.sum(approved_weights))
    total_sum = base_sum + approved_sum
    share = approved_sum / total_sum

    # Share must be <= 0.2001 (allowing minor floating precision tolerance)
    assert share <= 0.2001, f"Approved weight share {share:.4f} exceeded 20% cap"


def test_04_rollback_restores_previous_model_and_rescores():
    """Verify rollback restores chosen version, updates registry, and re-scores dataset."""
    # Retrain to version 2
    for i in range(5):
        cid = f"c_{i:04d}"
        add_case(case_id=f"case_{i}", cluster_id=cid, typology="cycle", label=1, source="analyst", status="approved", approved_by="Analyst_1")

    res = retrain(force=False)
    assert res["promoted"] is True
    assert list_models()["active_version"] == 2

    # Now rollback to version 1
    rb_res = rollback(1)
    assert rb_res["status"] == "rolled_back"
    assert rb_res["active_version"] == 1
    assert list_models()["active_version"] == 1

    # Verify scores.parquet exists and has valid scores
    assert retrain_module.SCORES_PATH.exists()
    scores_df = pl.read_parquet(str(retrain_module.SCORES_PATH))
    assert scores_df.height == 80
    assert "score" in scores_df.columns
