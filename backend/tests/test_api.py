"""End-to-end API behaviour, against an in-memory repository and stub model."""

from .conftest import APPLICANT_VECTOR

USER = "user_akshat_001"


def submit(client, **overrides) -> dict:
    payload = {**APPLICANT_VECTOR, "clerk_user_id": USER, "consent": True, **overrides}
    response = client.post("/applications", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


class TestSystem:
    def test_root_identifies_the_service(self, client):
        body = client.get("/").json()
        assert body["service"] == "IndiaScored API"
        assert body["author"] == "Akshat Sarkar"

    def test_health_reports_each_component(self, client):
        body = client.get("/health").json()
        assert set(body) >= {"status", "model_loaded", "explainer_loaded", "llm_available"}


class TestProfile:
    def test_profile_round_trips(self, client):
        client.post(
            "/profile",
            json={
                "clerk_user_id": USER,
                "name": "Akshat Sarkar",
                "gender": "male",
                "state": "West Bengal",
                "occupation": "farmer",
            },
        )
        body = client.get("/profile", params={"clerk_user_id": USER}).json()
        assert body["has_profile"] is True
        assert body["profile"]["name"] == "Akshat Sarkar"

    def test_an_unknown_applicant_has_no_profile(self, client):
        assert client.get("/profile", params={"clerk_user_id": "nobody"}).json()["has_profile"] is False


class TestPsychometric:
    def test_result_is_stored_and_read_back(self, client):
        client.post("/psychometric", json={"clerk_user_id": USER, "psychometric_score": 0.78})
        body = client.get("/psychometric/status", params={"clerk_user_id": USER}).json()
        assert body["completed"] is True
        assert body["score"] == 0.78

    def test_an_out_of_range_score_is_rejected(self, client):
        response = client.post("/psychometric", json={"clerk_user_id": USER, "psychometric_score": 1.4})
        assert response.status_code == 422

    def test_status_before_the_test_is_taken(self, client):
        assert client.get("/psychometric/status", params={"clerk_user_id": USER}).json()["completed"] is False


class TestScoring:
    def test_a_vector_can_be_scored_without_being_stored(self, client):
        card = client.post("/score", json=APPLICANT_VECTOR).json()
        assert 300 <= card["india_score"] <= 900
        assert card["grade"] in ("A+", "A", "B", "C", "D")
        assert len(card["drivers"]) == 2

    def test_a_strong_profile_is_approved(self, client):
        card = client.post("/score", json={**APPLICANT_VECTOR, "income_signal": 0.99}).json()
        assert card["decision"] == "Approved"
        assert card["sanctioned_amount"] == 150000

    def test_a_weak_profile_is_rejected_with_no_exposure(self, client):
        card = client.post("/score", json={**APPLICANT_VECTOR, "income_signal": 0.2}).json()
        assert card["decision"] == "Rejected"
        assert card["sanctioned_amount"] == 0

    def test_explanation_endpoint_attaches_a_remark(self, client):
        card = client.post("/score/explained", json=APPLICANT_VECTOR).json()
        assert card["narration"]["remark"]
        assert card["narration"]["generated_by"] in ("mistral", "rule_based")

    def test_an_invalid_category_is_rejected(self, client):
        response = client.post("/score", json={**APPLICANT_VECTOR, "loan_category": "crypto"})
        assert response.status_code == 422


class TestApplications:
    def test_submission_scores_immediately(self, client):
        body = submit(client)
        assert body["status"] == "scored"
        assert body["score_card"]["india_score"] > 300

    def test_consent_is_mandatory(self, client):
        response = client.post(
            "/applications", json={**APPLICANT_VECTOR, "clerk_user_id": USER, "consent": False}
        )
        assert response.status_code == 400

    def test_history_carries_a_blended_headline(self, client):
        submit(client)
        submit(client, loan_amount_requested=400000)
        body = client.get(f"/applications/{USER}").json()
        assert len(body["applications"]) == 2
        assert body["headline"]["loan_count"] == 2
        assert body["headline"]["grade"]

    def test_an_applicant_with_no_history_is_a_404(self, client):
        assert client.get("/applications/nobody").status_code == 404


class TestUnderwriting:
    def test_queue_reports_the_pipeline_and_grade_mix(self, client):
        submit(client)
        body = client.get("/underwriting/queue").json()
        assert body["pipeline"]["total"] == 1
        assert sum(body["grade_distribution"].values()) == 1
        assert len(body["applications"]) == 1

    def test_dossier_returns_profile_and_applications(self, client):
        client.post(
            "/profile",
            json={
                "clerk_user_id": USER,
                "name": "Akshat Sarkar",
                "gender": "male",
                "state": "West Bengal",
                "occupation": "farmer",
            },
        )
        submit(client)
        body = client.get(f"/underwriting/applicants/{USER}").json()
        assert body["profile"]["name"] == "Akshat Sarkar"
        assert body["applications"][0]["score_card"]

    def test_remark_generation_persists_the_narration(self, client, repo):
        submitted_at = submit(client)["submitted_at"]
        body = client.post(
            "/underwriting/remark", json={"clerk_user_id": USER, "submitted_at": submitted_at}
        ).json()
        assert body["narration"]["remark"]
        assert repo.get_application(USER, submitted_at)["narration"]["remark"]

    def test_a_decision_notifies_the_applicant(self, client):
        submitted_at = submit(client)["submitted_at"]
        response = client.patch(
            f"/underwriting/applications/{USER}/{submitted_at}",
            json={"status": "approved", "remarks": "Land record verified.", "reviewer": "akshat"},
        )
        assert response.status_code == 200
        assert "approved" in response.json()["applicant_message"]

        notifications = client.get(f"/notifications/{USER}").json()["notifications"]
        assert len(notifications) == 1
        assert notifications[0]["read"] is False

    def test_an_unknown_status_is_rejected(self, client):
        submitted_at = submit(client)["submitted_at"]
        response = client.patch(
            f"/underwriting/applications/{USER}/{submitted_at}", json={"status": "maybe"}
        )
        assert response.status_code == 422

    def test_deciding_on_a_missing_application_is_a_404(self, client):
        response = client.patch(
            f"/underwriting/applications/{USER}/not-a-timestamp", json={"status": "approved"}
        )
        assert response.status_code == 404


class TestNotifications:
    def test_unread_count_falls_to_zero_once_read(self, client):
        submitted_at = submit(client)["submitted_at"]
        client.patch(
            f"/underwriting/applications/{USER}/{submitted_at}", json={"status": "flagged"}
        )
        assert client.get(f"/notifications/{USER}/unread-count").json()["unread_count"] == 1

        client.patch(f"/notifications/{USER}/read")
        assert client.get(f"/notifications/{USER}/unread-count").json()["unread_count"] == 0

    def test_an_applicant_with_no_decisions_has_no_notifications(self, client):
        assert client.get(f"/notifications/{USER}").json()["notifications"] == []
