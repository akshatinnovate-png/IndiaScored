"""The explanation layer must never be the reason a decision is unavailable."""

from indiascored.explain.knowledge import FeatureKnowledgeBase, FeatureNote
from indiascored.explain.narrator import DecisionNarrator

KB = FeatureKnowledgeBase(
    {
        "num__coop_score": FeatureNote(
            key="num__coop_score",
            label="Cooperative / SHG standing",
            meaning="Peer-verified repayment record.",
            high="Weak standing leaves little evidence.",
            low="Strong standing substitutes for a bureau record.",
        )
    }
)

CARD = {
    "decision": "Approved",
    "grade": "A",
    "india_score": 742,
    "repayment_confidence": 0.93,
    "requested_amount": 100_000,
    "sanctioned_amount": 95_000,
    "drivers": [
        {"feature": "num__coop_score", "contribution": -0.42, "encoded_value": 0.8},
        {"feature": "num__unknown_signal", "contribution": 0.11, "encoded_value": 0.2},
    ],
}


class TestKnowledgeBase:
    def test_lookup_tolerates_preprocessor_prefixes(self):
        assert KB.lookup("coop_score") is not None
        assert KB.lookup("cat__coop_score") is not None

    def test_unknown_feature_returns_nothing(self):
        assert KB.lookup("num__not_a_feature") is None

    def test_retrieval_labels_direction_and_strength(self):
        retrieved = KB.retrieve(CARD["drivers"])
        assert retrieved[0]["direction"] == "reduces_risk"
        assert retrieved[0]["strength"] == "strong"
        assert retrieved[1]["direction"] == "increases_risk"
        assert retrieved[1]["strength"] == "moderate"

    def test_unknown_features_still_get_a_readable_label(self):
        assert KB.retrieve(CARD["drivers"])[1]["label"] == "Unknown Signal"

    def test_a_missing_file_yields_an_empty_base_not_a_crash(self):
        assert len(FeatureKnowledgeBase.from_file("/nonexistent/kb.json")) == 0


class TestNarrator:
    def test_falls_back_to_a_rule_based_remark_without_ollama(self, monkeypatch):
        narrator = DecisionNarrator(KB)
        monkeypatch.setattr(DecisionNarrator, "llm_available", property(lambda self: False))

        result = narrator.narrate(CARD, "Akshat Sarkar")

        assert result["generated_by"] == "rule_based"
        assert "Akshat Sarkar" in result["remark"]
        assert "742" in result["remark"]
        assert "document verification" in result["remark"]
        assert len(result["evidence"]) == 2

    def test_rejection_reads_as_a_rejection(self, monkeypatch):
        monkeypatch.setattr(DecisionNarrator, "llm_available", property(lambda self: False))
        card = {**CARD, "decision": "Rejected", "sanctioned_amount": 0}

        remark = DecisionNarrator(KB).narrate(card)["remark"]

        assert "declined" in remark.lower()

    def test_a_card_with_no_drivers_still_narrates(self, monkeypatch):
        monkeypatch.setattr(DecisionNarrator, "llm_available", property(lambda self: False))
        remark = DecisionNarrator(KB).narrate({**CARD, "drivers": []})["remark"]
        assert remark
