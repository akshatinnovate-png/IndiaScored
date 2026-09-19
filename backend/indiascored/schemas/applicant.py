"""Applicant-facing request bodies."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

UserType = Literal["smartphone", "feature_phone"]
Region = Literal["urban", "rural"]
AgeGroup = Literal["18-30", "31-50", "51-70"]
RechargePattern = Literal["always_on_time", "sometimes_late", "often_late"]
LoanCategory = Literal["education", "farmer", "startup", "personal"]


class ProfilePayload(BaseModel):
    """Identity and demographic details captured at onboarding."""

    clerk_user_id: str
    name: str
    gender: str
    state: str
    occupation: str


class AlternativeDataPayload(BaseModel):
    """The alternative-data vector the model actually scores.

    Every field is a signal available for someone with no bank statement,
    no salary slip and no bureau record.
    """

    user_type: UserType
    region: Region
    age_group: AgeGroup

    sms_count: float = Field(ge=0, description="Transactional SMS per month")
    bill_on_time_ratio: float = Field(default=0.0, ge=0, le=1, description="Share of utility bills paid on time")
    recharge_pattern: RechargePattern
    recharge_freq: float = Field(ge=0, le=1, description="Recharge regularity score")
    sim_tenure: float = Field(ge=0, description="Months on the same mobile number")
    location_stability: float = Field(ge=0, le=1)
    income_signal: float = Field(ge=0, le=1)
    coop_score: float = Field(ge=0, le=100, description="Cooperative / SHG standing")
    land_verified: int = Field(ge=0, le=1)
    psychometric_score: float = Field(ge=0, le=1)

    loan_amount_requested: float = Field(gt=0)
    loan_category: LoanCategory


class ApplicationPayload(AlternativeDataPayload):
    """An alternative-data vector submitted by a signed-in applicant."""

    clerk_user_id: str
    consent: bool = Field(default=True, description="Explicit consent to alternative-data processing")
