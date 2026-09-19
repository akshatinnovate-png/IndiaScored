"""FastAPI dependencies shared across routers."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status

from ..core.state import get_engine, get_narrator
from ..explain.narrator import DecisionNarrator
from ..repositories import ApplicantRepository
from ..scoring.engine import ScoringEngine


def repository() -> ApplicantRepository:
    return ApplicantRepository()


def engine() -> ScoringEngine:
    """The scoring engine, refusing the request if no model is loaded."""
    scoring_engine = get_engine()
    if not scoring_engine.bundle.is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scoring model is not loaded on this instance.",
        )
    return scoring_engine


def narrator() -> DecisionNarrator:
    return get_narrator()


RepositoryDep = Depends(repository)
EngineDep = Depends(engine)
NarratorDep = Depends(narrator)
