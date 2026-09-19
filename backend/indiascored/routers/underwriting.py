"""The underwriter's side: queue, per-file detail, remarks and decisions."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..explain.narrator import DecisionNarrator
from ..repositories import ApplicantRepository
from ..schemas import NarrationRequest, ReviewDecisionPayload
from ..scoring.engine import ModelUnavailable, ScoringEngine
from .dependencies import engine, narrator, repository

router = APIRouter(prefix="/underwriting", tags=["underwriting"])

#: What the applicant is told for each verdict.
APPLICANT_MESSAGES = {
    "approved": (
        "Your loan application has been approved. Please visit your nearest branch "
        "with your identity documents to complete verification and disbursal."
    ),
    "rejected": (
        "Your loan application could not be approved at this time. You may reapply "
        "after strengthening the factors listed in your score breakdown."
    ),
    "flagged": (
        "Your application needs an additional check. Our team will contact you shortly "
        "with the next steps."
    ),
    "pending": "Your application is under review. We will update you as soon as a decision is made.",
}


@router.get("/queue")
def review_queue(repo: ApplicantRepository = Depends(repository)) -> dict:
    """Everything the underwriting dashboard needs in one round trip."""
    return {
        "pipeline": repo.pipeline_summary(),
        "grade_distribution": repo.grade_distribution(),
        "applications": repo.review_queue(),
    }


@router.get("/applicants/{clerk_user_id}")
def applicant_dossier(
    clerk_user_id: str,
    repo: ApplicantRepository = Depends(repository),
    scoring_engine: ScoringEngine = Depends(engine),
) -> dict:
    """Full applicant file: profile, assessment and every scored application.

    Applications stored before scoring existed are scored lazily on first
    view and the result is written back, so the work happens only once.
    """
    applications = repo.list_applications(clerk_user_id)
    if not applications:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No applications found for this applicant."
        )

    for application in applications:
        if application.get("score_card"):
            continue
        try:
            card = scoring_engine.score(application.get("alternative_data") or {}).as_dict()
        except (ModelUnavailable, Exception):  # noqa: BLE001 - one bad file must not hide the rest
            continue
        repo.attach_score_card(clerk_user_id, application["submitted_at"], card)
        application["score_card"] = card

    return {
        "clerk_user_id": clerk_user_id,
        "profile": repo.get_profile(clerk_user_id),
        "psychometric": repo.get_psychometric(clerk_user_id),
        "applications": applications,
    }


@router.post("/remark")
def generate_remark(
    payload: NarrationRequest,
    repo: ApplicantRepository = Depends(repository),
    scoring_engine: ScoringEngine = Depends(engine),
    decision_narrator: DecisionNarrator = Depends(narrator),
) -> dict:
    """RAG: SHAP drivers -> feature knowledge base -> Mistral -> remark."""
    application = repo.get_application(payload.clerk_user_id, payload.submitted_at)
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")

    card = application.get("score_card")
    if not card:
        try:
            card = scoring_engine.score(application.get("alternative_data") or {}).as_dict()
        except ModelUnavailable as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
        repo.attach_score_card(payload.clerk_user_id, payload.submitted_at, card)

    narration = decision_narrator.narrate(card, repo.applicant_name(payload.clerk_user_id))
    repo.attach_narration(payload.clerk_user_id, payload.submitted_at, narration)

    return {"score_card": card, "narration": narration}


@router.patch("/applications/{clerk_user_id}/{submitted_at}")
def record_decision(
    clerk_user_id: str,
    submitted_at: str,
    payload: ReviewDecisionPayload,
    repo: ApplicantRepository = Depends(repository),
) -> dict:
    """Record the underwriter's verdict and notify the applicant."""
    message = APPLICANT_MESSAGES.get(payload.status, APPLICANT_MESSAGES["pending"])
    updated = repo.record_review(
        clerk_user_id=clerk_user_id,
        submitted_at=submitted_at,
        status=payload.status,
        remarks=payload.remarks,
        internal_notes=payload.internal_notes,
        reviewer=payload.reviewer,
        notification_message=message,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")

    return {
        "clerk_user_id": clerk_user_id,
        "submitted_at": submitted_at,
        "status": payload.status,
        "applicant_message": message,
    }
