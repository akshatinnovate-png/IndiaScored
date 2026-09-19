"""Training pipeline: raw applicants in, deployable model bundle out.

The steps, in order:

1. Feature engineering, reusing :mod:`indiascored.scoring.features` so the
   training and serving paths cannot drift apart.
2. A ``ColumnTransformer`` — impute + scale numerics, one-hot categoricals.
3. SMOTE on the training fold only, so the minority default class is
   learnable without leaking synthetic rows into validation or test.
4. Optuna (TPE) hyper-parameter search for LightGBM, scored on validation
   ROC-AUC.
5. Isotonic probability calibration on a held-out fold, because a credit
   decision needs a PD that means what it says, not just a good ranking.
6. A SHAP TreeExplainer built on the raw booster, bundled alongside.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from ..scoring.features import derive_features

logger = logging.getLogger(__name__)

TARGET = "defaulted"

NUMERIC_FEATURES = [
    "sms_count",
    "bill_on_time_ratio",
    "recharge_freq",
    "sim_tenure",
    "location_stability",
    "income_signal",
    "coop_score",
    "land_verified",
    "psychometric_score",
    "loan_amount_requested",
    "loan_amount_log",
    "sms_norm",
]

CATEGORICAL_FEATURES = [
    "user_type",
    "region",
    "age_group",
    "recharge_pattern",
    "loan_category",
]


@dataclass
class TrainingConfig:
    """Everything that controls a training run."""

    random_state: int = 20250919
    test_size: float = 0.20
    validation_size: float = 0.125  # of the remaining 80% -> 10% overall
    optuna_trials: int = 40
    optuna_timeout_seconds: int | None = 600
    use_smote: bool = True
    calibration_method: str = "isotonic"
    calibration_folds: int = 5


def build_preprocessor() -> ColumnTransformer:
    """Impute and scale numerics; one-hot the categoricals."""
    numeric = Pipeline(
        [
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
        ]
    )
    categorical = Pipeline(
        [
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("encode", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )
    return ColumnTransformer(
        [
            ("num", numeric, NUMERIC_FEATURES),
            ("cat", categorical, CATEGORICAL_FEATURES),
        ],
        remainder="drop",
        verbose_feature_names_out=True,
    )


def split_dataset(frame: pd.DataFrame, config: TrainingConfig):
    """Stratified 70 / 10 / 20 train / validation / test split."""
    engineered = derive_features(frame)
    X = engineered[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    y = engineered[TARGET].astype(int)

    X_fit, X_test, y_fit, y_test = train_test_split(
        X, y, test_size=config.test_size, stratify=y, random_state=config.random_state
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_fit,
        y_fit,
        test_size=config.validation_size,
        stratify=y_fit,
        random_state=config.random_state,
    )
    return X_train, X_val, X_test, y_train, y_val, y_test


def resample(X_encoded: np.ndarray, y: pd.Series, config: TrainingConfig):
    """SMOTE the training fold. Falls back to the raw fold if unavailable."""
    if not config.use_smote:
        return X_encoded, y
    try:
        from imblearn.over_sampling import SMOTE
    except ImportError:
        logger.warning("imbalanced-learn not installed; training without SMOTE")
        return X_encoded, y

    sampler = SMOTE(random_state=config.random_state)
    X_res, y_res = sampler.fit_resample(X_encoded, y)
    logger.info("SMOTE: %d rows -> %d rows", len(y), len(y_res))
    return X_res, y_res


def search_hyperparameters(
    X_train: np.ndarray,
    y_train: pd.Series,
    X_val: np.ndarray,
    y_val: pd.Series,
    config: TrainingConfig,
) -> dict[str, Any]:
    """Bayesian (TPE) search over the LightGBM space, maximising val ROC-AUC."""
    import lightgbm as lgb

    try:
        import optuna
    except ImportError:
        logger.warning("optuna not installed; falling back to default hyper-parameters")
        return {"n_estimators": 400, "learning_rate": 0.05, "num_leaves": 31}

    optuna.logging.set_verbosity(optuna.logging.WARNING)

    def objective(trial: "optuna.Trial") -> float:
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 200, 900, step=50),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.20, log=True),
            "num_leaves": trial.suggest_int("num_leaves", 15, 90),
            "max_depth": trial.suggest_int("max_depth", 3, 10),
            "min_child_samples": trial.suggest_int("min_child_samples", 10, 90),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "subsample_freq": 1,
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-4, 5.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-4, 5.0, log=True),
        }
        model = lgb.LGBMClassifier(
            objective="binary",
            random_state=config.random_state,
            n_jobs=-1,
            verbose=-1,
            **params,
        )
        model.fit(X_train, y_train)
        return roc_auc_score(y_val, model.predict_proba(X_val)[:, 1])

    study = optuna.create_study(
        direction="maximize",
        sampler=optuna.samplers.TPESampler(seed=config.random_state),
    )
    study.optimize(
        objective,
        n_trials=config.optuna_trials,
        timeout=config.optuna_timeout_seconds,
        show_progress_bar=False,
    )
    logger.info("Best validation ROC-AUC %.4f", study.best_value)
    return study.best_params


def evaluate(y_true, probabilities, threshold: float = 0.5) -> dict[str, float]:
    """The metrics that matter for a credit model, ranking and calibration."""
    predictions = (probabilities >= threshold).astype(int)
    return {
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "pr_auc": float(average_precision_score(y_true, probabilities)),
        "brier": float(brier_score_loss(y_true, probabilities)),
        "f1_default": float(f1_score(y_true, predictions, zero_division=0)),
        "precision_default": float(precision_score(y_true, predictions, zero_division=0)),
        "recall_default": float(recall_score(y_true, predictions, zero_division=0)),
        "default_rate": float(np.mean(y_true)),
    }


def train_bundle(
    frame: pd.DataFrame,
    config: TrainingConfig | None = None,
    output_path: str | Path | None = None,
) -> dict[str, Any]:
    """Run the whole pipeline and return the deployable bundle."""
    import lightgbm as lgb

    config = config or TrainingConfig()
    X_train, X_val, X_test, y_train, y_val, y_test = split_dataset(frame, config)

    preprocessor = build_preprocessor()
    X_train_enc = preprocessor.fit_transform(X_train)
    X_val_enc = preprocessor.transform(X_val)
    X_test_enc = preprocessor.transform(X_test)
    feature_names = [str(name) for name in preprocessor.get_feature_names_out()]

    X_train_res, y_train_res = resample(X_train_enc, y_train, config)

    best_params = search_hyperparameters(X_train_res, y_train_res, X_val_enc, y_val, config)

    booster = lgb.LGBMClassifier(
        objective="binary",
        random_state=config.random_state,
        n_jobs=-1,
        verbose=-1,
        **best_params,
    )
    booster.fit(X_train_res, y_train_res)

    # Calibrate on the untouched validation fold: SMOTE distorts the base
    # rate, so probabilities from the resampled fit are not trustworthy.
    calibrated = CalibratedClassifierCV(
        booster,
        method=config.calibration_method,
        cv=config.calibration_folds,
    )
    calibrated.fit(X_val_enc, y_val)

    metrics = {
        "raw_test": evaluate(y_test, booster.predict_proba(X_test_enc)[:, 1]),
        "calibrated_test": evaluate(y_test, calibrated.predict_proba(X_test_enc)[:, 1]),
        # The validation fold is deliberately not reported: the calibrator was
        # fitted on it, so any score there is in-sample and flattering.
    }

    explainer = None
    try:
        import shap

        explainer = shap.TreeExplainer(booster)
    except Exception:  # noqa: BLE001 - a bundle without SHAP still scores
        logger.exception("Could not build the SHAP explainer")

    bundle = {
        "preprocessor": preprocessor,
        "raw_model": booster,
        "calibrated_clf": calibrated,
        "explainer": explainer,
        "feature_names": feature_names,
        "metrics": metrics,
        "best_params": best_params,
        "trained_rows": int(len(frame)),
        "config": config.__dict__,
    }

    if output_path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(bundle, output_path)
        logger.info("Bundle written to %s", output_path)

    return bundle
