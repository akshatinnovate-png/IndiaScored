"""Feature engineering applied to a raw applicant record before inference.

The trained preprocessor expects the same derived columns that were present
at training time, so this module is the single source of truth for them and
is imported by both the API and the training notebook.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

#: Columns the model bundle requires on every inference row.
MODEL_INPUT_COLUMNS: tuple[str, ...] = (
    "user_type",
    "region",
    "age_group",
    "sms_count",
    "bill_on_time_ratio",
    "recharge_pattern",
    "recharge_freq",
    "sim_tenure",
    "location_stability",
    "income_signal",
    "coop_score",
    "land_verified",
    "psychometric_score",
    "loan_amount_requested",
    "loan_category",
)

#: Reference ceiling for SMS activity, frozen from the training distribution
#: so that a single-row prediction normalises identically to training.
SMS_REFERENCE_CEILING = 60.0

#: SIM tenure is captured in months and was scaled by a 10-year horizon.
SIM_TENURE_HORIZON_MONTHS = 120.0


def derive_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Add the engineered columns the preprocessor was fitted on.

    Normalisation uses frozen constants rather than batch statistics: a
    single-applicant request has no batch to normalise against, and using
    one would make a score depend on who else was in the request.
    """
    out = frame.copy()

    if "loan_amount_requested" in out.columns:
        out["loan_amount_log"] = np.log1p(
            pd.to_numeric(out["loan_amount_requested"], errors="coerce").fillna(0.0)
        )

    if "sms_count" in out.columns:
        sms = pd.to_numeric(out["sms_count"], errors="coerce").fillna(0.0)
        out["sms_norm"] = (sms / (SMS_REFERENCE_CEILING + 1.0)).clip(0.0, 1.0)

    if "sim_tenure" in out.columns:
        tenure = pd.to_numeric(out["sim_tenure"], errors="coerce").fillna(0.0)
        out["sim_tenure_years"] = tenure / 12.0

    return out


def to_model_frame(record: dict) -> pd.DataFrame:
    """Build a one-row, engineered DataFrame from an applicant payload."""
    row = {column: record.get(column) for column in MODEL_INPUT_COLUMNS}
    return derive_features(pd.DataFrame([row]))


def missing_model_fields(record: dict) -> list[str]:
    """Names of required model inputs absent or null in a stored record."""
    return [c for c in MODEL_INPUT_COLUMNS if record.get(c) is None]
