"""Applicant profile: identity and demographics."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ..repositories import ApplicantRepository
from ..schemas import ProfilePayload
from .dependencies import repository

router = APIRouter(prefix="/profile", tags=["profile"])


@router.post("")
def upsert_profile(
    payload: ProfilePayload, repo: ApplicantRepository = Depends(repository)
) -> dict:
    """Create or update the applicant's profile."""
    repo.upsert_profile(
        payload.clerk_user_id,
        {
            "name": payload.name,
            "gender": payload.gender,
            "state": payload.state,
            "occupation": payload.occupation,
        },
    )
    return {"status": "stored", "clerk_user_id": payload.clerk_user_id}


@router.get("")
def read_profile(
    clerk_user_id: str, repo: ApplicantRepository = Depends(repository)
) -> dict:
    profile = repo.get_profile(clerk_user_id)
    return {"profile": profile, "has_profile": profile is not None}
