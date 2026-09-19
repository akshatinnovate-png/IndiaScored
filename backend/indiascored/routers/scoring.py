"""Direct scoring: run the model without persisting anything."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..explain.narrator import DecisionNarrator
from ..repositories import ApplicantRepository
from ..schemas import AlternativeDataPayload, NarrationRequest, ScoreCardResponse
from ..scoring.engine import ModelUnavailable, ScoringEngine
from .dependencies import engine, narrator, repository

router = APIRouter(prefix="/score", tags=["scoring"])


@router.post("", response_model=ScoreCardResponse)
def score_vector(
    payload: AlternativeDataPayload,
    scoring_engine: ScoringEngine = Depends(engine),
) -> dict:
    """Score an alternative-data vector. Nothing is written to the database."""
    try:
        return scoring_engine.score(payload.model_dump()).as_dict()
    except ModelUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/explained", response_model=ScoreCardResponse)
def score_and_explain(
    payload: AlternativeDataPayload,
    scoring_engine: ScoringEngine = Depends(engine),
    decision_narrator: DecisionNarrator = Depends(narrator),
) -> dict:
    """Score a vector and attach the natural-language underwriting remark."""
    try:
        card = scoring_engine.score(payload.model_dump()).as_dict()
    except ModelUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    card["narration"] = decision_narrator.narrate(card)
    return card


@router.post("/rescore")
def rescore_stored_application(
    payload: NarrationRequest,
    repo: ApplicantRepository = Depends(repository),
    scoring_engine: ScoringEngine = Depends(engine),
) -> dict:
    """Re-run the current model over a stored application.

    Used after a model refresh, so an old file can be brought onto the new
    model without the applicant re-applying.
    """
    application = repo.get_application(payload.clerk_user_id, payload.submitted_at)
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")

    try:
        card = scoring_engine.score(application.get("alternative_data") or {}).as_dict()
    except ModelUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    repo.attach_score_card(payload.clerk_user_id, payload.submitted_at, card)
    return {"clerk_user_id": payload.clerk_user_id, "submitted_at": payload.submitted_at, "score_card": card}
