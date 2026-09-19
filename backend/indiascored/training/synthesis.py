"""Synthetic thin-file applicant generator.

No public dataset exists for Indian applicants who have *no* bureau record,
so the training set is simulated from a structural model: each alternative
signal is drawn from a plausible marginal distribution, the signals combine
into a latent default propensity through hand-set log-odds weights, and the
intercept is solved numerically so the realised default rate hits a target.

Because the ground truth is generated rather than observed, the numbers a
model reaches here describe the pipeline, not the Indian credit market.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Mapping

import numpy as np
import pandas as pd
from scipy.optimize import brentq

LOAN_CATEGORIES = ("education", "farmer", "startup", "personal")
RECHARGE_PATTERNS = ("always_on_time", "sometimes_late", "often_late")
AGE_GROUPS = ("18-30", "31-50", "51-70")

#: Log-odds contribution of each signal. Negative lowers default propensity.
DEFAULT_WEIGHTS: Mapping[str, float] = {
    "sms_activity": -0.60,
    "bill_punctuality": -2.00,
    "recharge_regularity": -1.20,
    "sim_tenure": -0.30,
    "location_stability": -1.50,
    "income_signal": -2.50,
    "cooperative_standing": -1.00,
    "land_verified": -0.80,
    "psychometric": -2.80,
    "loan_burden": 0.90,
}


@dataclass
class SynthesisConfig:
    """Knobs for the generator."""

    n_applicants: int = 12_000
    target_default_rate: float = 0.20
    random_seed: int = 20250919
    weights: Mapping[str, float] = field(default_factory=lambda: dict(DEFAULT_WEIGHTS))
    #: Noise on the latent score, so the signals are informative but not deterministic.
    latent_noise_sd: float = 0.55


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _solve_intercept(latent: np.ndarray, target_rate: float) -> float:
    """Shift the latent score so the mean default probability hits the target."""
    def gap(intercept: float) -> float:
        return float(_sigmoid(latent + intercept).mean() - target_rate)

    return float(brentq(gap, -25.0, 25.0))


def _draw_signals(rng: np.random.Generator, n: int) -> dict[str, np.ndarray]:
    """Marginal distributions for each alternative-data signal."""
    user_type = rng.choice(["smartphone", "feature_phone"], size=n, p=[0.70, 0.30])
    region = rng.choice(["urban", "rural"], size=n, p=[0.55, 0.45])
    age_group = rng.choice(AGE_GROUPS, size=n, p=[0.40, 0.40, 0.20])

    # Smartphone users generate several times the transactional SMS volume.
    sms_count = np.where(
        user_type == "smartphone", rng.poisson(30, n), rng.poisson(8, n)
    ).astype(float)

    # Most people pay most bills on time; the left tail is what matters.
    bill_on_time_ratio = np.clip(rng.beta(5, 2, n), 0.0, 1.0)

    recharge_pattern = rng.choice(RECHARGE_PATTERNS, size=n, p=[0.60, 0.30, 0.10])
    recharge_freq = np.select(
        [recharge_pattern == "always_on_time", recharge_pattern == "sometimes_late"],
        [1.0, 0.5],
        default=0.2,
    )

    sim_tenure = rng.integers(1, 121, n).astype(float)

    # Urban applicants move less within a 12-month window than rural migrants.
    location_stability = np.where(
        region == "urban",
        np.clip(rng.normal(0.80, 0.10, n), 0, 1),
        np.clip(rng.normal(0.62, 0.15, n), 0, 1),
    )

    # Inferred income tracks bill punctuality, but imperfectly.
    income_signal = np.clip(bill_on_time_ratio + rng.normal(0, 0.12, n), 0.0, 1.0)

    # Cooperative / SHG standing is denser and more meaningful in rural areas.
    coop_score = np.where(
        region == "rural",
        np.clip(rng.normal(68, 16, n), 0, 100),
        np.clip(rng.normal(58, 18, n), 0, 100),
    )

    land_verified = np.where(
        region == "rural", rng.binomial(1, 0.38, n), rng.binomial(1, 0.09, n)
    )

    psychometric_score = np.clip(rng.normal(0.60, 0.16, n), 0.0, 1.0)

    loan_amount_requested = rng.integers(10_000, 500_001, n).astype(float)
    loan_category = rng.choice(LOAN_CATEGORIES, size=n)

    return {
        "user_type": user_type,
        "region": region,
        "age_group": age_group,
        "sms_count": sms_count,
        "bill_on_time_ratio": bill_on_time_ratio,
        "recharge_pattern": recharge_pattern,
        "recharge_freq": recharge_freq,
        "sim_tenure": sim_tenure,
        "location_stability": location_stability,
        "income_signal": income_signal,
        "coop_score": coop_score,
        "land_verified": land_verified,
        "psychometric_score": psychometric_score,
        "loan_amount_requested": loan_amount_requested,
        "loan_category": loan_category,
    }


def _latent_default_score(
    signals: Mapping[str, np.ndarray], weights: Mapping[str, float]
) -> np.ndarray:
    """Combine the signals into a latent log-odds of default."""
    score = (
        weights["sms_activity"] * (signals["sms_count"] / 60.0).clip(0, 1)
        + weights["bill_punctuality"] * signals["bill_on_time_ratio"]
        + weights["recharge_regularity"] * signals["recharge_freq"]
        + weights["sim_tenure"] * (signals["sim_tenure"] / 120.0)
        + weights["location_stability"] * signals["location_stability"]
        + weights["income_signal"] * signals["income_signal"]
        + weights["cooperative_standing"] * (signals["coop_score"] / 100.0)
        + weights["land_verified"] * signals["land_verified"]
        + weights["psychometric"] * signals["psychometric_score"]
        + weights["loan_burden"] * (np.log1p(signals["loan_amount_requested"]) / np.log(500_000))
    )

    # --- Interactions a purely additive model would miss -------------------

    # Chronically late recharges are a stronger marker than the linear term.
    score += np.where(signals["recharge_pattern"] == "often_late", 1.10, 0.0)

    # Rural applicant with weak cooperative standing: no peer-verified record.
    score += 0.85 * ((signals["region"] == "rural") & (signals["coop_score"] < 50))

    # Below a subsistence income signal, risk rises sharply rather than smoothly.
    score += np.where(signals["income_signal"] < 0.30, 1.40, 0.0)

    # A verified holding partially offsets a weak behavioural profile.
    score += -0.60 * ((signals["land_verified"] == 1) & (signals["psychometric_score"] < 0.45))

    # Startup lending to a very short-tenure applicant is the riskiest cell.
    score += 0.70 * ((signals["loan_category"] == "startup") & (signals["sim_tenure"] < 12))

    return score


def generate_dataset(config: SynthesisConfig | None = None) -> pd.DataFrame:
    """Generate a labelled thin-file applicant dataset."""
    config = config or SynthesisConfig()
    rng = np.random.default_rng(config.random_seed)
    n = config.n_applicants

    signals = _draw_signals(rng, n)

    latent = _latent_default_score(signals, config.weights)
    latent = latent + rng.normal(0.0, config.latent_noise_sd, n)
    latent = latent + _solve_intercept(latent, config.target_default_rate)

    probability = np.clip(_sigmoid(latent), 1e-4, 1 - 1e-4)
    defaulted = (rng.random(n) < probability).astype(int)

    frame = pd.DataFrame(
        {
            "applicant_id": [f"IS_{i:06d}" for i in range(1, n + 1)],
            **signals,
            "true_pd": probability,
            "defaulted": defaulted,
        }
    )
    return frame
