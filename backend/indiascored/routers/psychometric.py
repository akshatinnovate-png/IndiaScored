"""The timed behavioural assessment."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ..repositories import ApplicantRepository
from ..schemas import PsychometricPayload
from .dependencies import repository

router = APIRouter(prefix="/psychometric", tags=["psychometric"])


@router.post("")
def save_result(
    payload: PsychometricPayload, repo: ApplicantRepository = Depends(repository)
) -> dict:
    """Store an assessment result. Validation of the 0-1 range is in the schema."""
    saved = repo.save_psychometric(payload.clerk_user_id, payload.psychometric_score)
    return {"status": "saved", "clerk_user_id": payload.clerk_user_id, **saved}


@router.get("/status")
def assessment_status(
    clerk_user_id: str, repo: ApplicantRepository = Depends(repository)
) -> dict:
    result = repo.get_psychometric(clerk_user_id)
    if not result:
        return {"completed": False, "score": None, "taken_at": None}
    return {"completed": True, **result}
