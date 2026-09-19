"""Liveness and readiness."""

from __future__ import annotations

from fastapi import APIRouter

from ..core.config import get_settings
from ..core.state import get_bundle, get_knowledge_base, get_narrator

router = APIRouter(tags=["system"])


@router.get("/")
def root() -> dict:
    settings = get_settings()
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "author": settings.author,
        "docs": "/docs",
    }


@router.get("/health")
def health() -> dict:
    """Readiness, component by component, so a degraded state is visible."""
    bundle = get_bundle()
    return {
        "status": "healthy" if bundle.is_ready else "degraded",
        "model_loaded": bundle.is_ready,
        "explainer_loaded": bundle.explains,
        "encoded_features": len(bundle.feature_names or []),
        "knowledge_base_entries": len(get_knowledge_base()),
        "llm_available": get_narrator().llm_available,
        "model_error": bundle.error,
    }
