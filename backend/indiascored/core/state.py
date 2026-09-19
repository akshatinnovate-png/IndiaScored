"""Process-wide singletons wired up once at startup."""

from __future__ import annotations

from functools import lru_cache

from ..explain.knowledge import FeatureKnowledgeBase
from ..explain.narrator import DecisionNarrator
from ..scoring.bundle import ModelBundle, load_bundle
from ..scoring.engine import ScoringEngine
from .config import get_settings


@lru_cache(maxsize=1)
def get_bundle() -> ModelBundle:
    return load_bundle(get_settings().bundle_path)


@lru_cache(maxsize=1)
def get_engine() -> ScoringEngine:
    return ScoringEngine(get_bundle(), top_k_drivers=get_settings().top_k_drivers)


@lru_cache(maxsize=1)
def get_knowledge_base() -> FeatureKnowledgeBase:
    return FeatureKnowledgeBase.from_file(get_settings().knowledge_base_path)


@lru_cache(maxsize=1)
def get_narrator() -> DecisionNarrator:
    settings = get_settings()
    return DecisionNarrator(
        knowledge_base=get_knowledge_base(),
        model=settings.llm_model,
        timeout_seconds=settings.llm_timeout_seconds,
    )
