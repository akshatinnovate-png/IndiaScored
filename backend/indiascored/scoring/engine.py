"""The scoring engine: applicant record in, explained decision out."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field, asdict
from typing import Any

import numpy as np

from .bundle import ModelBundle
from .features import to_model_frame
from .grading import grade_pd, sanctionable_amount

logger = logging.getLogger(__name__)

#: Grades that clear the automated approval gate.
APPROVABLE_GRADES = ("A+", "A", "B", "C")

#: Grade at which a decision is routed to a human rather than auto-approved.
MANUAL_REVIEW_GRADE = "C"


class ModelUnavailable(RuntimeError):
    """Raised when scoring is requested but no model bundle is loaded."""


@dataclass
class FeatureAttribution:
    """One SHAP contribution, in the encoded feature space."""

    feature: str
    contribution: float
    encoded_value: float

    @property
    def direction(self) -> str:
        return "increases_risk" if self.contribution > 0 else "reduces_risk"


@dataclass
class ScoreCard:
    """The complete, explainable outcome of one scoring run."""

    probability_of_default: float
    grade: str
    india_score: int
    repayment_confidence: float
    indicative_apr: float
    requested_amount: int
    sanctioned_amount: int
    decision: str
    drivers: list[FeatureAttribution] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["drivers"] = [
            {**asdict(d), "direction": d.direction} for d in self.drivers
        ]
        return payload


class ScoringEngine:
    """Turns an applicant record into a graded, explained credit decision."""

    def __init__(self, bundle: ModelBundle, top_k_drivers: int = 5) -> None:
        self._bundle = bundle
        self._top_k = top_k_drivers

    @property
    def bundle(self) -> ModelBundle:
        return self._bundle

    def score(self, record: dict, top_k: int | None = None) -> ScoreCard:
        """Score one applicant record."""
        if not self._bundle.is_ready:
            raise ModelUnavailable(self._bundle.error or "model bundle not loaded")

        frame = to_model_frame(record)
        pd_value = self._bundle.pipeline.probability_of_default(frame)
        risk = grade_pd(pd_value)

        requested = int(float(record.get("loan_amount_requested") or 0))
        sanctioned = sanctionable_amount(requested, risk.grade)

        return ScoreCard(
            probability_of_default=round(risk.probability_of_default, 6),
            grade=risk.grade,
            india_score=risk.india_score,
            repayment_confidence=round(risk.repayment_confidence, 4),
            indicative_apr=risk.indicative_apr,
            requested_amount=requested,
            sanctioned_amount=sanctioned,
            decision=self._decide(risk.grade, sanctioned),
            drivers=self._attribute(frame, top_k or self._top_k),
        )

    @staticmethod
    def _decide(grade: str, sanctioned: int) -> str:
        if grade not in APPROVABLE_GRADES or sanctioned <= 0:
            return "Rejected"
        if grade == MANUAL_REVIEW_GRADE:
            return "Review"
        return "Approved"

    def _attribute(self, frame, top_k: int) -> list[FeatureAttribution]:
        """Top SHAP drivers, ranked by absolute contribution.

        Explanation is best-effort: a failure here must not cost the
        applicant their score, so it degrades to an empty driver list.
        """
        if not self._bundle.explains:
            return []
        try:
            encoded = self._bundle.pipeline.encode(frame)
            values = self._bundle.explainer.shap_values(encoded)
            if isinstance(values, list):  # binary classifiers return one array per class
                values = values[1]
            row = np.asarray(values)[0]

            ranked = np.argsort(np.abs(row))[::-1][:top_k]
            names = self._bundle.feature_names or []
            return [
                FeatureAttribution(
                    feature=names[i] if i < len(names) else f"feature_{i}",
                    contribution=float(row[i]),
                    encoded_value=float(np.asarray(encoded)[0, i]),
                )
                for i in ranked
            ]
        except Exception:  # noqa: BLE001 - explanation is non-critical
            logger.exception("SHAP attribution failed; returning score without drivers")
            return []
