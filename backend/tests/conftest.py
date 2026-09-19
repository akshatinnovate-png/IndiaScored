"""Test fixtures: an app wired to an in-memory repository and a stub model.

Nothing here touches MongoDB or the artifacts directory, so the API surface
can be tested anywhere, including in CI.
"""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient

from indiascored.main import create_app
from indiascored.repositories.applicants import utc_now_iso
from indiascored.routers import dependencies
from indiascored.scoring.bundle import ModelBundle
from indiascored.scoring.engine import ScoringEngine

APPLICANT_VECTOR = {
    "user_type": "smartphone",
    "region": "rural",
    "age_group": "31-50",
    "sms_count": 30,
    "bill_on_time_ratio": 0.85,
    "recharge_pattern": "always_on_time",
    "recharge_freq": 1.0,
    "sim_tenure": 60,
    "location_stability": 0.75,
    "income_signal": 0.7,
    "coop_score": 75,
    "land_verified": 1,
    "psychometric_score": 0.72,
    "loan_amount_requested": 150000,
    "loan_category": "farmer",
}


class InMemoryRepository:
    """A dict-backed stand-in with the same surface as ApplicantRepository."""

    def __init__(self) -> None:
        self.profiles: dict[str, dict] = {}
        self.psychometrics: dict[str, dict] = {}
        self.applications: dict[tuple[str, str], dict] = {}

    # profiles
    def upsert_profile(self, clerk_user_id, profile):
        self.profiles[clerk_user_id] = dict(profile)

    def get_profile(self, clerk_user_id):
        return self.profiles.get(clerk_user_id)

    def applicant_name(self, clerk_user_id):
        return (self.profiles.get(clerk_user_id) or {}).get("name", "the applicant")

    # psychometric
    def save_psychometric(self, clerk_user_id, score):
        record = {"score": score, "taken_at": utc_now_iso()}
        self.psychometrics[clerk_user_id] = record
        return record

    def get_psychometric(self, clerk_user_id):
        return self.psychometrics.get(clerk_user_id)

    # applications
    def create_application(self, clerk_user_id, alternative_data, consent):
        submitted_at = f"{utc_now_iso()}-{len(self.applications)}"
        self.applications[(clerk_user_id, submitted_at)] = {
            "clerk_user_id": clerk_user_id,
            "submitted_at": submitted_at,
            "alternative_data": dict(alternative_data),
            "consent": consent,
            "status": "submitted",
            "score_card": None,
            "narration": None,
        }
        return submitted_at

    def list_applications(self, clerk_user_id, limit=50):
        return [a for (uid, _), a in self.applications.items() if uid == clerk_user_id][:limit]

    def get_application(self, clerk_user_id, submitted_at):
        return self.applications.get((clerk_user_id, submitted_at))

    def attach_score_card(self, clerk_user_id, submitted_at, score_card):
        app = self.applications[(clerk_user_id, submitted_at)]
        app["score_card"] = dict(score_card)
        app["status"] = "pending"

    def attach_narration(self, clerk_user_id, submitted_at, narration):
        self.applications[(clerk_user_id, submitted_at)]["narration"] = dict(narration)

    def record_review(self, clerk_user_id, submitted_at, status, remarks,
                      internal_notes, reviewer, notification_message):
        app = self.applications.get((clerk_user_id, submitted_at))
        if not app:
            return False
        app["status"] = status
        app["review"] = {"remarks": remarks, "internal_notes": internal_notes, "reviewer": reviewer}
        app["notification"] = {"message": notification_message, "read": False,
                               "issued_at": utc_now_iso()}
        return True

    # notifications
    def list_notifications(self, clerk_user_id):
        return [
            {
                "id": f"{clerk_user_id}::{app['submitted_at']}",
                "message": app["notification"]["message"],
                "read": app["notification"]["read"],
                "status": app["status"],
                "submitted_at": app["submitted_at"],
            }
            for (uid, _), app in self.applications.items()
            if uid == clerk_user_id and app.get("notification")
        ]

    def unread_count(self, clerk_user_id):
        return sum(1 for n in self.list_notifications(clerk_user_id) if not n["read"])

    def mark_notifications_read(self, clerk_user_id, submitted_at=None):
        marked = 0
        for (uid, ts), app in self.applications.items():
            if uid != clerk_user_id or not app.get("notification"):
                continue
            if submitted_at and ts != submitted_at:
                continue
            if not app["notification"]["read"]:
                app["notification"]["read"] = True
                marked += 1
        return marked

    # underwriting
    def pipeline_summary(self):
        summary = {"total": 0, "open": 0, "approved": 0, "adverse": 0, "by_status": {}}
        for app in self.applications.values():
            status = app["status"]
            summary["total"] += 1
            summary["by_status"][status] = summary["by_status"].get(status, 0) + 1
            if status in ("submitted", "pending"):
                summary["open"] += 1
            elif status == "approved":
                summary["approved"] += 1
            elif status in ("rejected", "flagged"):
                summary["adverse"] += 1
        return summary

    def grade_distribution(self):
        distribution: dict[str, int] = {}
        for app in self.applications.values():
            grade = (app.get("score_card") or {}).get("grade")
            if grade:
                distribution[grade] = distribution.get(grade, 0) + 1
        return distribution

    def review_queue(self, limit=100):
        return [
            {
                "clerk_user_id": app["clerk_user_id"],
                "submitted_at": app["submitted_at"],
                "status": app["status"],
                "name": self.applicant_name(app["clerk_user_id"]),
                "india_score": (app.get("score_card") or {}).get("india_score"),
                "grade": (app.get("score_card") or {}).get("grade"),
            }
            for app in list(self.applications.values())[:limit]
        ]


class StubPipeline:
    """Scores on one signal, so tests can steer the decision deliberately."""

    def encode(self, frame):
        return np.zeros((1, 2))

    def probability_of_default(self, frame):
        # A healthy income signal means a low PD; a weak one means a high PD.
        return float(1.0 - frame["income_signal"].iloc[0])

    def predict_proba(self, frame):
        pd_value = self.probability_of_default(frame)
        return np.array([[1 - pd_value, pd_value]])


class StubExplainer:
    def shap_values(self, encoded):
        return np.array([[-0.44, 0.21]])


@pytest.fixture
def repo() -> InMemoryRepository:
    return InMemoryRepository()


@pytest.fixture
def client(repo, monkeypatch) -> TestClient:
    monkeypatch.setattr("indiascored.main.ensure_indexes", lambda: None)

    app = create_app()
    stub_engine = ScoringEngine(
        ModelBundle(
            pipeline=StubPipeline(),
            explainer=StubExplainer(),
            feature_names=["num__coop_score", "num__income_signal"],
        )
    )
    app.dependency_overrides[dependencies.repository] = lambda: repo
    app.dependency_overrides[dependencies.engine] = lambda: stub_engine

    with TestClient(app) as test_client:
        yield test_client
