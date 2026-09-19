"""Generation half of the RAG layer: retrieved notes -> underwriter's remark.

A local Mistral model served by Ollama writes the remark. When Ollama is not
installed the narrator falls back to a deterministic, fully rule-based
summary, so the dashboard always shows a usable explanation.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
from typing import Mapping, Sequence

from .knowledge import FeatureKnowledgeBase

logger = logging.getLogger(__name__)

PROMPT_TEMPLATE = """You are a credit underwriting assistant at IndiaScored, a lender
that assesses applicants with no formal credit history using alternative data.

Write a 2-3 sentence remark for the loan officer reviewing this file.

Applicant: {name}
Requested principal: Rs {requested:,}
Sanctionable under policy: Rs {sanctioned:,}
Model decision: {decision}
IndiaScore: {india_score} / 900 (risk grade {grade})
Repayment confidence: {confidence:.1f}%

The model's decision was driven by these factors, strongest first:
{drivers}

Rules for the remark:
- Open by stating the decision.
- Cite the two strongest factors by name, saying whether each helped or hurt
  and how strongly.
- For an approval, note that disbursal remains subject to document verification.
- For a rejection, name the concerns plainly and without hedging.
- For a review, name the conflicting evidence that needs a human judgement.
- Plain professional English. No jargon, no SHAP values, no bullet points.
"""


class DecisionNarrator:
    """Turns a score card into a natural-language underwriting remark."""

    def __init__(
        self,
        knowledge_base: FeatureKnowledgeBase,
        model: str = "mistral",
        timeout_seconds: int = 120,
    ) -> None:
        self._kb = knowledge_base
        self._model = model
        self._timeout = timeout_seconds

    @property
    def llm_available(self) -> bool:
        return shutil.which("ollama") is not None

    def narrate(self, score_card: Mapping, applicant_name: str = "the applicant") -> dict:
        """Produce a remark plus the retrieved evidence behind it."""
        evidence = self._kb.retrieve(score_card.get("drivers", []))
        prompt = self._build_prompt(score_card, applicant_name, evidence)

        remark, source = self._generate(prompt), "mistral"
        if remark is None:
            remark, source = self._fallback(score_card, applicant_name, evidence), "rule_based"

        return {"remark": remark, "generated_by": source, "evidence": evidence}

    def _build_prompt(
        self, card: Mapping, name: str, evidence: Sequence[Mapping]
    ) -> str:
        lines = [
            f"- {item['label']}: {item['strength']} effect that "
            f"{'raised the risk' if item['direction'] == 'increases_risk' else 'improved the profile'}. "
            f"{item['reading']}"
            for item in evidence
        ] or ["- No feature attributions were available for this file."]

        return PROMPT_TEMPLATE.format(
            name=name,
            requested=int(card.get("requested_amount") or 0),
            sanctioned=int(card.get("sanctioned_amount") or 0),
            decision=card.get("decision", "Review"),
            india_score=card.get("india_score", "n/a"),
            grade=card.get("grade", "n/a"),
            confidence=float(card.get("repayment_confidence") or 0.0) * 100,
            drivers="\n".join(lines),
        )

    def _generate(self, prompt: str) -> str | None:
        """Run the local model, returning None if it is unavailable."""
        if not self.llm_available:
            logger.info("Ollama not on PATH; using rule-based narration")
            return None
        try:
            completed = subprocess.run(
                ["ollama", "run", self._model],
                input=prompt.encode("utf-8"),
                capture_output=True,
                check=True,
                timeout=self._timeout,
            )
            text = completed.stdout.decode("utf-8", errors="replace").strip()
            return text or None
        except (subprocess.SubprocessError, OSError):
            logger.exception("Ollama generation failed; using rule-based narration")
            return None

    @staticmethod
    def _fallback(card: Mapping, name: str, evidence: Sequence[Mapping]) -> str:
        """Deterministic remark, used whenever the LLM cannot be reached."""
        decision = card.get("decision", "Review")
        opening = {
            "Approved": (
                f"{name} is approved for Rs {int(card.get('sanctioned_amount') or 0):,} "
                f"against a request of Rs {int(card.get('requested_amount') or 0):,}"
            ),
            "Rejected": f"{name}'s application is declined under current credit policy",
            "Review": f"{name}'s application is referred for manual review",
        }.get(decision, f"{name}'s application was assessed")

        headline = (
            f"{opening}, on an IndiaScore of {card.get('india_score', 'n/a')} "
            f"(grade {card.get('grade', 'n/a')}, "
            f"{float(card.get('repayment_confidence') or 0.0) * 100:.1f}% repayment confidence)."
        )

        helped = [e for e in evidence if e["direction"] == "reduces_risk"][:2]
        hurt = [e for e in evidence if e["direction"] == "increases_risk"][:2]

        parts = [headline]
        if helped:
            parts.append(
                "In its favour: "
                + "; ".join(f"{e['label']} ({e['strength']})" for e in helped)
                + "."
            )
        if hurt:
            parts.append(
                "Working against it: "
                + "; ".join(f"{e['label']} ({e['strength']})" for e in hurt)
                + "."
            )
        if decision == "Approved":
            parts.append("Disbursal remains subject to document verification.")

        return " ".join(parts)
