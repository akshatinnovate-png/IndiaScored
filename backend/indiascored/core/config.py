"""Application settings, read once from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


def _csv_env(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    """Everything the app needs to know about its environment."""

    app_name: str = "IndiaScored API"
    app_version: str = "1.0.0"
    author: str = "Akshat Sarkar"

    mongo_uri: str = field(default_factory=lambda: os.getenv("MONGO_URI", "mongodb://localhost:27017"))
    mongo_db: str = field(default_factory=lambda: os.getenv("MONGO_DB", "indiascored"))

    bundle_path: Path = field(
        default_factory=lambda: Path(
            os.getenv("MODEL_BUNDLE_PATH", str(BACKEND_ROOT / "artifacts" / "indiascored_pipeline_bundle.pkl"))
        )
    )
    knowledge_base_path: Path = field(
        default_factory=lambda: Path(
            os.getenv(
                "FEATURE_KB_PATH",
                str(BACKEND_ROOT / "indiascored" / "explain" / "feature_knowledge_base.json"),
            )
        )
    )

    llm_model: str = field(default_factory=lambda: os.getenv("OLLAMA_MODEL", "mistral"))
    llm_timeout_seconds: int = field(default_factory=lambda: int(os.getenv("OLLAMA_TIMEOUT", "120")))

    cors_origins: list[str] = field(
        default_factory=lambda: _csv_env(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        )
    )
    top_k_drivers: int = field(default_factory=lambda: int(os.getenv("TOP_K_DRIVERS", "5")))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
