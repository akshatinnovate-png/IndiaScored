/**
 * The explanation layer, ported from backend/indiascored/explain/.
 *
 * Retrieval: each SHAP driver is looked up in the feature knowledge base.
 * Generation: the deterministic rule-based remark the backend falls back to
 * when no local LLM is installed — the browser build has none, so it always
 * uses this path.
 */

import type { Driver, Narration, ScoreCard } from "../types.ts";
import knowledgeBase from "./feature-knowledge-base.json";

interface FeatureNote {
  label: string;
  meaning: string;
  high: string;
  low: string;
}

const NOTES = knowledgeBase as Record<string, FeatureNote>;

function lookup(feature: string): FeatureNote | undefined {
  if (NOTES[feature]) return NOTES[feature];
  const bare = feature.split("__").slice(1).join("__") || feature;
  return Object.entries(NOTES).find(([key]) => (key.split("__").slice(1).join("__") || key) === bare)?.[1];
}

function humanise(feature: string): string {
  const bare = feature.includes("__") ? feature.slice(feature.indexOf("__") + 2) : feature;
  return bare
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function strength(contribution: number): "strong" | "moderate" | "minor" {
  const magnitude = Math.abs(contribution);
  if (magnitude >= 0.3) return "strong";
  if (magnitude >= 0.1) return "moderate";
  return "minor";
}

export function retrieve(drivers: Driver[]): Narration["evidence"] {
  return drivers.map((driver) => {
    const note = lookup(driver.feature);
    const contribution = Number(driver.contribution);
    return {
      feature: driver.feature,
      label: note ? note.label : humanise(driver.feature),
      contribution,
      direction: contribution > 0 ? "increases_risk" : "reduces_risk",
      strength: strength(contribution),
      meaning: note ? note.meaning : "",
      // A positive contribution pushes the PD up: the unfavourable reading.
      reading: note ? (contribution > 0 ? note.high : note.low) : "",
    };
  });
}

const rupees = (n: number) => Math.trunc(n || 0).toLocaleString("en-US");

export function narrate(card: ScoreCard, name = "the applicant"): Narration {
  const evidence = retrieve(card.drivers ?? []);
  const decision = card.decision ?? "Review";
  const opening =
    {
      Approved: `${name} is approved for Rs ${rupees(card.sanctioned_amount)} against a request of Rs ${rupees(card.requested_amount)}`,
      Rejected: `${name}'s application is declined under current credit policy`,
      Review: `${name}'s application is referred for manual review`,
    }[decision] ?? `${name}'s application was assessed`;

  const parts = [
    `${opening}, on an IndiaScore of ${card.india_score} (grade ${card.grade}, ` +
      `${((card.repayment_confidence || 0) * 100).toFixed(1)}% repayment confidence).`,
  ];

  const helped = evidence.filter((e) => e.direction === "reduces_risk").slice(0, 2);
  const hurt = evidence.filter((e) => e.direction === "increases_risk").slice(0, 2);
  if (helped.length) parts.push(`In its favour: ${helped.map((e) => `${e.label} (${e.strength})`).join("; ")}.`);
  if (hurt.length) parts.push(`Working against it: ${hurt.map((e) => `${e.label} (${e.strength})`).join("; ")}.`);
  if (decision === "Approved") parts.push("Disbursal remains subject to document verification.");

  return { remark: parts.join(" "), generated_by: "rule_based", evidence };
}
