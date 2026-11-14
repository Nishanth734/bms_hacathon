"""Configuration for TraceFlow AML pipeline."""
from __future__ import annotations

import os
from pathlib import Path
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    # Temporal window
    TIME_WINDOW_HOURS: float = 24.0

    # Fan-in / fan-out
    FAN_IN_OUT_MIN_COUNTERPARTIES: int = 5

    # Cycle detector
    CYCLE_MIN_LENGTH: int = 3
    CYCLE_MAX_LENGTH: int = 5

    # Pass-through detector
    PASS_THROUGH_MIN_HOPS: int = 3
    PASS_THROUGH_MAX_DWELL_HOURS: float = 1.0

    # Retention bands
    RETENTION_BAND_LOW: float = 0.85
    RETENTION_BAND_HIGH: float = 1.0

    # Cluster caps
    CLUSTER_SIZE_CAP: int = 30
    CLUSTER_LABEL_ILLICIT_THRESHOLD: float = 0.5

    # Train/val/test split fractions
    TRAIN_SPLIT: float = 0.6
    VAL_SPLIT: float = 0.2
    TEST_SPLIT: float = 0.2

    # Baseline threshold
    AMOUNT_THRESHOLD_BASELINE: float = 10_000.0

    # Evaluation
    PRECISION_AT_K: int = 20

    # Paths (from env or defaults)
    IBM_CSV_PATH: str = field(default_factory=lambda: os.getenv("IBM_CSV_PATH", "data/HI-Small_Trans.csv"))
    RESULTS_DIR: str = field(default_factory=lambda: os.getenv("RESULTS_DIR", "results"))
    MODELS_DIR: str = field(default_factory=lambda: os.getenv("MODELS_DIR", "models"))

    # LLM settings
    LLM_ENABLED: bool = field(default_factory=lambda: os.getenv("LLM_ENABLED", "false").lower() == "true")
    LLM_HOST: str = field(default_factory=lambda: os.getenv("LLM_HOST", "http://localhost:11434"))
    LLM_MODEL: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "llama3.1:8b"))
    GROQ_API_KEY: str = field(default_factory=lambda: os.getenv("GROQ_API_KEY", ""))
    GROQ_MODEL: str = field(default_factory=lambda: os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"))

    # Learning loop settings
    LEARNING_MIN_NEW_CASES: int = 5
    LEARNING_CASE_WEIGHT: float = 5.0
    LEARNING_MAX_CASE_WEIGHT_SHARE: float = 0.2
    LEARNING_GATE_MAX_METRIC_DROP: float = 0.01
    LEARNING_INCIDENT_TX_ID_OFFSET: int = 10_000_000_000
    USE_LLM: bool = False

    def __post_init__(self) -> None:
        # Load from config.yaml if present
        yaml_path = Path("config.yaml")
        if yaml_path.exists():
            try:
                import yaml
                with open(yaml_path, "r", encoding="utf-8") as f:
                    cfg_dict = yaml.safe_load(f) or {}
                learning_cfg = cfg_dict.get("learning", {})
                if "min_new_cases_to_retrain" in learning_cfg:
                    self.LEARNING_MIN_NEW_CASES = int(learning_cfg["min_new_cases_to_retrain"])
                if "case_weight" in learning_cfg:
                    self.LEARNING_CASE_WEIGHT = float(learning_cfg["case_weight"])
                if "max_case_weight_share" in learning_cfg:
                    self.LEARNING_MAX_CASE_WEIGHT_SHARE = float(learning_cfg["max_case_weight_share"])
                if "gate_max_metric_drop" in learning_cfg:
                    self.LEARNING_GATE_MAX_METRIC_DROP = float(learning_cfg["gate_max_metric_drop"])
                if "incident_tx_id_offset" in learning_cfg:
                    self.LEARNING_INCIDENT_TX_ID_OFFSET = int(learning_cfg["incident_tx_id_offset"])
                if "use_llm" in cfg_dict:
                    self.USE_LLM = bool(cfg_dict["use_llm"])
            except Exception:
                pass
        assert abs(self.TRAIN_SPLIT + self.VAL_SPLIT + self.TEST_SPLIT - 1.0) < 1e-6, (
            "TRAIN_SPLIT + VAL_SPLIT + TEST_SPLIT must equal 1.0"
        )
        assert 0.0 < self.RETENTION_BAND_LOW <= self.RETENTION_BAND_HIGH <= 1.0
        assert self.CYCLE_MIN_LENGTH >= 2
        assert self.CYCLE_MAX_LENGTH >= self.CYCLE_MIN_LENGTH


_config_singleton: Config | None = None


def get_config() -> Config:
    """Return the global Config singleton, initialised once."""
    global _config_singleton
    if _config_singleton is None:
        _config_singleton = Config()
    return _config_singleton
