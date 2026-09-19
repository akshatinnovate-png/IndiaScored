"""The scoring engine's decision rules, exercised against a stub model."""

import numpy as np
import pytest

from indiascored.scoring.bundle import ModelBundle
from indiascored.scoring.engine import ModelUnavailable, ScoringEngine

APPLICANT = {
    "user_type": "smartphone",
    "region": "urban",
    "age_group": "18-30",
    "sms_count": 42,
    "bill_on_time_ratio": 0.9,
    "recharge_pattern": "always_on_time",
    "recharge_freq": 1.0,
    "sim_tenure": 84,
    "location_stability": 0.9,
    "income_signal": 0.8,
    "coop_score": 80,
    "land_verified": 1,
    "psychometric_score": 0.75,
    "loan_amount_requested": 200_000,
    "loan_category": "personal",
}


class StubPipeline:
    """Returns a fixed PD and an identity encoding."""

    def __init__(self, pd_value: float) -> None:
        self._pd = pd_value

    def encode(self, frame):
        return np.zeros((1, 3))

    def predict_proba(self, frame):
        return np.array([[1 - self._pd, self._pd]])

    def probability_of_default(self, frame):
        return self._pd


class StubExplainer:
    def shap_values(self, encoded):
        return np.array([[0.51, -0.22, 0.03]])


def engine_for(pd_value: float, explains: bool = True) -> ScoringEngine:
    return ScoringEngine(
        ModelBundle(
            pipeline=StubPipeline(pd_value),
            explainer=StubExplainer() if explains else None,
            feature_names=["num__coop_score", "num__income_signal", "num__sms_count"],
        )
    )


class TestDecisions:
    def test_low_risk_is_approved_at_full_exposure(self):
        card = engine_for(0.02).score(APPLICANT)
        assert card.grade == "A+"
        assert card.decision == "Approved"
        assert card.sanctioned_amount == 200_000

    def test_borderline_risk_is_routed_to_a_human(self):
        card = engine_for(0.25).score(APPLICANT)
        assert card.grade == "C"
        assert card.decision == "Review"
        assert card.sanctioned_amount == 110_000

    def test_high_risk_is_rejected_with_no_exposure(self):
        card = engine_for(0.60).score(APPLICANT)
        assert card.grade == "D"
        assert card.decision == "Rejected"
        assert card.sanctioned_amount == 0


class TestAttribution:
    def test_drivers_are_ranked_by_absolute_contribution(self):
        drivers = engine_for(0.05).score(APPLICANT).drivers
        assert [d.feature for d in drivers] == [
            "num__coop_score",
            "num__income_signal",
            "num__sms_count",
        ]

    def test_direction_follows_the_sign_of_the_contribution(self):
        drivers = engine_for(0.05).score(APPLICANT).drivers
        assert drivers[0].direction == "increases_risk"
        assert drivers[1].direction == "reduces_risk"

    def test_top_k_is_respected(self):
        assert len(engine_for(0.05).score(APPLICANT, top_k=2).drivers) == 2

    def test_a_score_survives_a_broken_explainer(self):
        engine = engine_for(0.05)

        class Exploding:
            def shap_values(self, encoded):
                raise RuntimeError("explainer blew up")

        engine.bundle.explainer = Exploding()
        card = engine.score(APPLICANT)

        assert card.india_score > 300
        assert card.drivers == []

    def test_no_explainer_means_no_drivers(self):
        assert engine_for(0.05, explains=False).score(APPLICANT).drivers == []


class TestSerialisation:
    def test_dict_form_carries_the_direction(self):
        payload = engine_for(0.05).score(APPLICANT).as_dict()
        assert payload["drivers"][0]["direction"] == "increases_risk"
        assert payload["decision"] == "Approved"


def test_scoring_without_a_model_is_an_explicit_failure():
    with pytest.raises(ModelUnavailable):
        ScoringEngine(ModelBundle(error="artifact missing")).score(APPLICANT)
