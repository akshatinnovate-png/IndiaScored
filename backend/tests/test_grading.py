"""The credit policy is pure maths, so it gets tested exhaustively."""

import pytest

from indiascored.scoring.grading import (
    EXPOSURE_CAP,
    PD_CEILING,
    PD_FLOOR,
    clamp_pd,
    blend_portfolio,
    grade_from_pd,
    grade_pd,
    india_score_from_pd,
    indicative_apr,
    sanctionable_amount,
)


class TestIndiaScore:
    def test_score_stays_inside_the_published_band(self):
        for pd_value in (0.0, 1e-9, 0.001, 0.25, 0.5, 0.99, 1.0):
            assert 300 <= india_score_from_pd(pd_value) <= 900

    def test_score_falls_as_risk_rises(self):
        scores = [india_score_from_pd(p) for p in (0.01, 0.05, 0.2, 0.5, 0.9)]
        assert scores == sorted(scores, reverse=True)

    def test_even_odds_lands_mid_band(self):
        assert india_score_from_pd(0.5) == 600

    def test_band_is_configurable(self):
        assert 0 <= india_score_from_pd(0.3, floor=0, ceiling=100) <= 100


class TestGradeLadder:
    @pytest.mark.parametrize(
        "pd_value,expected",
        [
            (0.00, "A+"),
            (0.049, "A+"),
            (0.05, "A"),
            (0.099, "A"),
            (0.10, "B"),
            (0.199, "B"),
            (0.20, "C"),
            (0.349, "C"),
            (0.35, "D"),
            (1.00, "D"),
        ],
    )
    def test_boundaries(self, pd_value, expected):
        assert grade_from_pd(pd_value) == expected

    def test_every_grade_has_a_cap_and_a_rate(self):
        for _, _, grade in [(0, 0, g) for g in ("A+", "A", "B", "C", "D")]:
            assert grade in EXPOSURE_CAP
            assert indicative_apr(grade) > 0

    def test_apr_rises_with_risk(self):
        rates = [indicative_apr(g) for g in ("A+", "A", "B", "C", "D")]
        assert rates == sorted(rates)


class TestSanctioning:
    def test_best_grade_gets_the_full_ask(self):
        assert sanctionable_amount(100_000, "A+") == 100_000

    def test_exposure_is_capped_by_grade(self):
        assert sanctionable_amount(100_000, "B") == 80_000
        assert sanctionable_amount(100_000, "C") == 55_000

    def test_worst_grade_gets_nothing(self):
        assert sanctionable_amount(100_000, "D") == 0

    def test_unknown_grade_is_treated_as_unsanctionable(self):
        assert sanctionable_amount(100_000, "Z") == 0

    def test_negative_request_cannot_produce_a_sanction(self):
        assert sanctionable_amount(-5_000, "A+") == 0


class TestPdClamping:
    def test_a_certain_outcome_is_never_accepted(self):
        assert clamp_pd(0.0) == PD_FLOOR
        assert clamp_pd(1.0) == PD_CEILING

    def test_ordinary_values_pass_through(self):
        assert clamp_pd(0.18) == pytest.approx(0.18)

    def test_a_clamped_pd_cannot_reach_a_perfect_score(self):
        assert grade_pd(0.0).india_score < 900


class TestGradePd:
    def test_bundles_every_derived_figure(self):
        risk = grade_pd(0.08)
        assert risk.grade == "A"
        assert risk.repayment_confidence == pytest.approx(0.92)
        assert 300 <= risk.india_score <= 900
        assert set(risk.as_dict()) == {
            "probability_of_default",
            "grade",
            "india_score",
            "repayment_confidence",
            "indicative_apr",
        }


class TestPortfolioBlend:
    def test_empty_history_is_not_an_error(self):
        assert blend_portfolio([])["loan_count"] == 0

    def test_large_exposure_dominates_the_headline(self):
        blended = blend_portfolio(
            [
                {"india_score": 800, "loan_amount_requested": 1_000, "repayment_confidence": 0.95},
                {"india_score": 400, "loan_amount_requested": 999_000, "repayment_confidence": 0.40},
            ]
        )
        assert blended["india_score"] < 450
        assert blended["grade"] == "D"
        assert blended["loan_count"] == 2

    def test_unscored_applications_are_ignored(self):
        blended = blend_portfolio(
            [
                {"india_score": None, "loan_amount_requested": 10_000},
                {"india_score": 720, "loan_amount_requested": 10_000, "repayment_confidence": 0.9},
            ]
        )
        assert blended["loan_count"] == 1
        assert blended["grade"] == "A"
