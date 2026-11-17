"""Application configuration via environment variables."""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """CXR Triage backend settings, loaded from env vars / .env file."""

    DATABASE_URL: str = "sqlite:///./cxr_triage.db"
    SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    MODEL_VERSION: str = "0.1.0"
    UPLOAD_DIR: str = "./uploads"
    LOG_LEVEL: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
