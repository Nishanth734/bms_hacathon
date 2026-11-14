"""Configuration for TraceFlow AML pipeline."""
from __future__ import annotations

import os
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

    def __post_init__(self) -> None:
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
