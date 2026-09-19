"""Loading and wrapping the serialized model bundle.

The bundle is a single ``.pkl`` carrying the fitted preprocessor, the
probability-calibrated classifier, the SHAP explainer and the encoded
feature names. Swapping a retrained model is therefore a file drop, not a
code change.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _as_name_list(names: Any) -> list[str]:
    """Normalise feature names to a plain list.

    The bundle may carry them as a list or as a numpy array, and a numpy
    array has no usable truth value — so the conversion is explicit.
    """
    if names is None:
        return []
    return [str(name) for name in np.asarray(names).ravel().tolist()]


class CalibratedPipeline:
    """Pairs the fitted preprocessor with the calibrated classifier."""

    def __init__(self, preprocessor: Any, classifier: Any) -> None:
        self.preprocessor = preprocessor
        self.classifier = classifier

    def encode(self, frame: pd.DataFrame) -> np.ndarray:
        return self.preprocessor.transform(frame)

    def predict_proba(self, frame: pd.DataFrame) -> np.ndarray:
        return self.classifier.predict_proba(self.encode(frame))

    def probability_of_default(self, frame: pd.DataFrame) -> float:
        return float(self.predict_proba(frame)[:, 1][0])

    def predict(self, frame: pd.DataFrame, threshold: float = 0.5) -> np.ndarray:
        return (self.predict_proba(frame)[:, 1] >= threshold).astype(int)


@dataclass
class ModelBundle:
    """Everything loaded from disk at application startup."""

    pipeline: CalibratedPipeline | None = None
    explainer: Any | None = None
    feature_names: list[str] | None = None
    source: str | None = None
    error: str | None = None

    @property
    def is_ready(self) -> bool:
        return self.pipeline is not None

    @property
    def explains(self) -> bool:
        return self.explainer is not None and bool(self.feature_names)


def load_bundle(path: str | Path) -> ModelBundle:
    """Load the bundle, degrading to an unready bundle instead of crashing.

    A missing artifact must not take the whole API down: ``/health`` reports
    the degraded state and scoring routes answer with a clear 503.
    """
    path = Path(path)
    try:
        raw = joblib.load(path)
        bundle = ModelBundle(
            pipeline=CalibratedPipeline(raw["preprocessor"], raw["calibrated_clf"]),
            explainer=raw.get("explainer"),
            feature_names=_as_name_list(raw.get("feature_names")),
            source=str(path),
        )
        logger.info("Model bundle loaded from %s (%d encoded features)",
                    path, len(bundle.feature_names or []))
        return bundle
    except Exception as exc:  # noqa: BLE001 - startup must stay non-fatal
        logger.exception("Could not load model bundle from %s", path)
        return ModelBundle(source=str(path), error=str(exc))
