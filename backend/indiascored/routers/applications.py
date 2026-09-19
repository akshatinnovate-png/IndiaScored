"""Loan applications: submission, scoring on submit, and history."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..repositories import ApplicantRepository
from ..schemas import ApplicationPayload
from ..scoring import blend_portfolio
from ..scoring.engine import ModelUnavailable, ScoringEngine
from .dependencies import engine, repository

router = APIRouter(prefix="/applications", tags=["applications"])


@router.post("", status_code=status.HTTP_201_CREATED)
def submit_application(
    payload: ApplicationPayload,
    repo: ApplicantRepository = Depends(repository),
    scoring_engine: ScoringEngine = Depends(engine),
) -> dict:
    """Store an application and score it in the same call.

    Scoring on submit means the underwriting queue is never full of
    unscored files waiting for someone to open them.
    """
    if not payload.consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alternative-data processing requires explicit consent.",
        )

    alternative_data = payload.model_dump(exclude={"clerk_user_id", "consent"})
    submitted_at = repo.create_application(payload.clerk_user_id, alternative_data, payload.consent)

    try:
        card = scoring_engine.score(alternative_data).as_dict()
    except ModelUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    repo.attach_score_card(payload.clerk_user_id, submitted_at, card)
    return {
        "status": "scored",
        "clerk_user_id": payload.clerk_user_id,
        "submitted_at": submitted_at,
        "score_card": card,
    }


@router.get("/{clerk_user_id}")
def list_applications(
    clerk_user_id: str, repo: ApplicantRepository = Depends(repository)
) -> dict:
    """An applicant's full history plus their blended headline score."""
    applications = repo.list_applications(clerk_user_id)
    if not applications:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No applications found for this applicant.",
        )

    blendable = [
        {
            "india_score": (app.get("score_card") or {}).get("india_score"),
            "repayment_confidence": (app.get("score_card") or {}).get("repayment_confidence"),
            "loan_amount_requested": (app.get("alternative_data") or {}).get("loan_amount_requested"),
        }
        for app in applications
    ]

    return {
        "clerk_user_id": clerk_user_id,
        "applications": applications,
        "headline": blend_portfolio(blendable),
    }


@router.get("/{clerk_user_id}/{submitted_at}")
def read_application(
    clerk_user_id: str, submitted_at: str, repo: ApplicantRepository = Depends(repository)
) -> dict:
    application = repo.get_application(clerk_user_id, submitted_at)
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    return application
