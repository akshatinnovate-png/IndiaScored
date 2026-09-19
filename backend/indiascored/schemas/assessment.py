"""Assessment, scoring and narration contracts."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class PsychometricPayload(BaseModel):
    """Result of the timed behavioural assessment."""

    clerk_user_id: str
    psychometric_score: float = Field(ge=0, le=1)


class DriverResponse(BaseModel):
    """One SHAP attribution as returned to the client."""

    feature: str
    contribution: float
    encoded_value: float
    direction: str


class ScoreCardResponse(BaseModel):
    """The explained decision returned by every scoring route."""

    probability_of_default: float
    grade: str
    india_score: int
    repayment_confidence: float
    indicative_apr: float
    requested_amount: int
    sanctioned_amount: int
    decision: str
    drivers: list[DriverResponse] = Field(default_factory=list)
    narration: Optional[dict[str, Any]] = None


class NarrationRequest(BaseModel):
    """Ask for an underwriter's remark on one stored application."""

    clerk_user_id: str
    submitted_at: str = Field(description="ISO timestamp identifying the application")
