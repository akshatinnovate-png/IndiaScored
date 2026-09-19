"""Underwriter review contracts."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ReviewStatus = Literal["approved", "rejected", "flagged", "pending"]


class ReviewDecisionPayload(BaseModel):
    """An underwriter's verdict on an application."""

    status: ReviewStatus
    remarks: str = Field(default="", description="Shown to the applicant")
    internal_notes: str = Field(default="", description="Never shown to the applicant")
    reviewer: str = Field(default="admin")
