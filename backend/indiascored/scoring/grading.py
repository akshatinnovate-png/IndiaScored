"""Pure risk-grading maths.

Everything here is a deterministic function of a probability of default (PD).
No model, no database, no framework — which makes the whole credit policy of
IndiaScored unit-testable in isolation.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

# --- Credit policy constants -------------------------------------------------

#: Lower bound (inclusive), upper bound (exclusive), grade label.
GRADE_LADDER: Sequence[tuple[float, float, str]] = (
    (0.00, 0.05, "A+"),
    (0.05, 0.10, "A"),
    (0.10, 0.20, "B"),
    (0.20, 0.35, "C"),
    (0.35, 1.01, "D"),
)

#: Fraction of the requested principal a grade is allowed to draw.
EXPOSURE_CAP: Mapping[str, float] = {
    "A+": 1.00,
    "A": 0.95,
    "B": 0.80,
    "C": 0.55,
    "D": 0.00,
}

#: Indicative annual rate offered per grade, in percent.
INDICATIVE_APR: Mapping[str, float] = {
    "A+": 10.5,
    "A": 12.5,
    "B": 15.0,
    "C": 19.5,
    "D": 24.0,
}

#: No file is treated as risk-free or as a certain default. Isotonic
#: calibration saturates at exactly 0 and 1 at the tails, and a PD of 0
#: would claim a certainty no credit model earns.
PD_FLOOR = 0.001
PD_CEILING = 0.999

SCORE_FLOOR = 300
SCORE_CEILING = 900

#: Log-odds window mapped onto the score band. PD 0.5 lands mid-scale, and
#: the window is wide enough that a PD at the policy floor or ceiling still
#: lands just inside the band rather than pinned to its endpoint.
_LOGIT_WINDOW = (-7.0, 7.0)

def _score_ladder() -> Sequence[tuple[float, str]]:
    """Score thresholds for each grade, derived from the PD ladder itself.

    A blended score and a single application's PD must not disagree about
    what grade an applicant is, so the thresholds are computed from the same
    bins rather than hardcoded alongside them.
    """
    return tuple(
        (float(india_score_from_pd(upper)), label)
        for _, upper, label in GRADE_LADDER
        if label != "D"
    )


@dataclass(frozen=True)
class RiskGrade:
    """A PD translated into everything a loan officer actually needs."""

    probability_of_default: float
    grade: str
    india_score: int
    repayment_confidence: float
    indicative_apr: float

    def as_dict(self) -> dict:
        return {
            "probability_of_default": round(self.probability_of_default, 6),
            "grade": self.grade,
            "india_score": self.india_score,
            "repayment_confidence": round(self.repayment_confidence, 4),
            "indicative_apr": self.indicative_apr,
        }


def india_score_from_pd(
    probability_of_default: float,
    floor: int = SCORE_FLOOR,
    ceiling: int = SCORE_CEILING,
) -> int:
    """Map a PD onto the familiar 300-900 consumer-credit band.

    A logit transform is used rather than a linear one so that the crowded
    low-PD region — where most thin-file applicants sit — is spread out
    across usable score points instead of being squashed at the top.
    """
    p = min(max(float(probability_of_default), 1e-6), 1 - 1e-6)
    log_odds = -math.log(p / (1 - p))
    low, high = _LOGIT_WINDOW
    position = (log_odds - low) / (high - low)
    position = min(max(position, 0.0), 1.0)
    return int(round(floor + (ceiling - floor) * position))


def grade_from_pd(probability_of_default: float) -> str:
    """Bin a PD into the A+ ... D ladder."""
    p = float(probability_of_default)
    for low, high, label in GRADE_LADDER:
        if low <= p < high:
            return label
    return "D"


def sanctionable_amount(requested: float, grade: str) -> int:
    """Scale the requested principal by the exposure cap for a grade."""
    cap = EXPOSURE_CAP.get(grade, 0.0)
    return int(math.floor(max(float(requested), 0.0) * cap))


def indicative_apr(grade: str) -> float:
    """Indicative annual rate for a grade, in percent."""
    return INDICATIVE_APR.get(grade, INDICATIVE_APR["D"])


def clamp_pd(probability_of_default: float) -> float:
    """Hold a PD inside the band credit policy is willing to act on."""
    return min(max(float(probability_of_default), PD_FLOOR), PD_CEILING)


def grade_pd(probability_of_default: float) -> RiskGrade:
    """Bundle every PD-derived figure into one immutable record."""
    pd_value = clamp_pd(probability_of_default)
    grade = grade_from_pd(pd_value)
    return RiskGrade(
        probability_of_default=pd_value,
        grade=grade,
        india_score=india_score_from_pd(pd_value),
        repayment_confidence=1.0 - pd_value,
        indicative_apr=indicative_apr(grade),
    )


def blend_portfolio(loans: Iterable[Mapping]) -> dict:
    """Collapse an applicant's loan history into one headline score.

    Larger exposures move the headline score more than small ones, so a
    single tiny well-scored loan cannot mask a large risky one.
    """
    entries = [loan for loan in loans if loan.get("india_score") is not None]
    if not entries:
        return {
            "india_score": None,
            "grade": None,
            "loan_count": 0,
            "repayment_confidence": None,
        }

    weights = [max(float(loan.get("loan_amount_requested") or 1), 1.0) for loan in entries]
    total_weight = sum(weights)

    score = sum(float(l["india_score"]) * w for l, w in zip(entries, weights)) / total_weight
    confidence = sum(
        float(l.get("repayment_confidence") or 0.0) * w for l, w in zip(entries, weights)
    ) / total_weight

    grade = "D"
    for threshold, label in _score_ladder():
        if score >= threshold:
            grade = label
            break

    return {
        "india_score": round(score, 2),
        "grade": grade,
        "loan_count": len(entries),
        "repayment_confidence": round(confidence, 4),
    }
