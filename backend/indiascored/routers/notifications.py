"""Applicant-facing notifications raised by underwriting decisions."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends

from ..repositories import ApplicantRepository
from .dependencies import repository

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/{clerk_user_id}")
def list_notifications(
    clerk_user_id: str, repo: ApplicantRepository = Depends(repository)
) -> dict:
    return {"notifications": repo.list_notifications(clerk_user_id)}


@router.get("/{clerk_user_id}/unread-count")
def unread_count(
    clerk_user_id: str, repo: ApplicantRepository = Depends(repository)
) -> dict:
    return {"unread_count": repo.unread_count(clerk_user_id)}


@router.patch("/{clerk_user_id}/read")
def mark_read(
    clerk_user_id: str,
    submitted_at: Optional[str] = None,
    repo: ApplicantRepository = Depends(repository),
) -> dict:
    """Mark one notification read, or all of them when no timestamp is given."""
    updated = repo.mark_notifications_read(clerk_user_id, submitted_at)
    return {"marked_read": updated}
