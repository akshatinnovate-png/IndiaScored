"""Retrieval half of the RAG layer: encoded feature name -> domain knowledge."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FeatureNote:
    """What the platform knows about one model feature, in plain language."""

    key: str
    label: str
    meaning: str
    high: str
    low: str

    def reading(self, contribution: float) -> str:
        """The note that applies given which way this feature pushed the PD.

        A positive SHAP contribution pushes the probability of default up,
        so it is the *unfavourable* reading of the feature.
        """
        return self.high if contribution > 0 else self.low


class FeatureKnowledgeBase:
    """A small curated store of credit-domain notes, keyed by feature name."""

    def __init__(self, notes: Mapping[str, FeatureNote]) -> None:
        self._notes = dict(notes)

    @classmethod
    def from_file(cls, path: str | Path) -> "FeatureKnowledgeBase":
        path = Path(path)
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001 - narration degrades, scoring does not
            logger.exception("Could not read feature knowledge base at %s", path)
            return cls({})

        notes = {
            key: FeatureNote(
                key=key,
                label=entry.get("label", key),
                meaning=entry.get("meaning", ""),
                high=entry.get("high", ""),
                low=entry.get("low", ""),
            )
            for key, entry in raw.items()
        }
        logger.info("Feature knowledge base loaded: %d entries", len(notes))
        return cls(notes)

    def __len__(self) -> int:
        return len(self._notes)

    def lookup(self, feature: str) -> FeatureNote | None:
        """Find a note, tolerating the preprocessor's ``num__``/``cat__`` prefixes."""
        if feature in self._notes:
            return self._notes[feature]
        bare = feature.split("__", 1)[-1]
        for key, note in self._notes.items():
            if key.split("__", 1)[-1] == bare:
                return note
        return None

    def retrieve(self, drivers: Iterable[Mapping]) -> list[dict]:
        """Attach domain knowledge to each SHAP driver, strongest first."""
        retrieved: list[dict] = []
        for driver in drivers:
            feature = str(driver.get("feature", ""))
            contribution = float(driver.get("contribution", 0.0))
            note = self.lookup(feature)
            retrieved.append(
                {
                    "feature": feature,
                    "label": note.label if note else _humanise(feature),
                    "contribution": contribution,
                    "direction": "increases_risk" if contribution > 0 else "reduces_risk",
                    "strength": _strength(contribution),
                    "meaning": note.meaning if note else "",
                    "reading": note.reading(contribution) if note else "",
                }
            )
        return retrieved


def _humanise(feature: str) -> str:
    return feature.split("__", 1)[-1].replace("_", " ").title()


def _strength(contribution: float) -> str:
    magnitude = abs(contribution)
    if magnitude >= 0.30:
        return "strong"
    if magnitude >= 0.10:
        return "moderate"
    return "minor"
