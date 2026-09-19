"""Feature engineering must be deterministic per row, not per batch."""

import pandas as pd

from indiascored.scoring.features import (
    MODEL_INPUT_COLUMNS,
    derive_features,
    missing_model_fields,
    to_model_frame,
)

SAMPLE = {
    "user_type": "smartphone",
    "region": "rural",
    "age_group": "31-50",
    "sms_count": 30,
    "bill_on_time_ratio": 0.8,
    "recharge_pattern": "always_on_time",
    "recharge_freq": 1.0,
    "sim_tenure": 60,
    "location_stability": 0.7,
    "income_signal": 0.65,
    "coop_score": 72,
    "land_verified": 1,
    "psychometric_score": 0.7,
    "loan_amount_requested": 120_000,
    "loan_category": "farmer",
}


def test_frame_carries_every_model_input():
    frame = to_model_frame(SAMPLE)
    assert len(frame) == 1
    for column in MODEL_INPUT_COLUMNS:
        assert column in frame.columns


def test_derived_columns_are_added():
    frame = to_model_frame(SAMPLE)
    for column in ("loan_amount_log", "sms_norm", "sim_tenure_years"):
        assert column in frame.columns


def test_normalisation_does_not_depend_on_the_batch():
    """A row must score identically alone and alongside others."""
    alone = derive_features(pd.DataFrame([SAMPLE]))
    crowded = derive_features(pd.DataFrame([SAMPLE, {**SAMPLE, "sms_count": 5_000}]))
    assert alone.loc[0, "sms_norm"] == crowded.loc[0, "sms_norm"]


def test_missing_fields_are_reported():
    incomplete = {k: v for k, v in SAMPLE.items() if k != "coop_score"}
    assert missing_model_fields(incomplete) == ["coop_score"]
    assert missing_model_fields(SAMPLE) == []
