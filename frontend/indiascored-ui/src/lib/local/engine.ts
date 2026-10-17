/** Applicant record in, explained decision out — ported from scoring/engine.py. */

import type { AlternativeData, Decision, Driver, RiskGrade, ScoreCard } from "../types.ts";
import { gradePd, roundTo, sanctionableAmount } from "./grading.ts";
import { encode, probabilityOfDefault, shapValues, type ModelJson } from "./model.ts";

const APPROVABLE_GRADES: RiskGrade[] = ["A+", "A", "B", "C"];
const MANUAL_REVIEW_GRADE: RiskGrade = "C";

function decide(grade: RiskGrade, sanctioned: number): Decision {
  if (!APPROVABLE_GRADES.includes(grade) || sanctioned <= 0) return "Rejected";
  if (grade === MANUAL_REVIEW_GRADE) return "Review";
  return "Approved";
}

export function scoreRecord(
  model: ModelJson,
  record: AlternativeData | Record<string, unknown>,
  topK = 5,
): ScoreCard {
  const data = record as Record<string, unknown>;
  const x = encode(model, data);
  const risk = gradePd(probabilityOfDefault(model, x));

  const requested = Math.trunc(Number(data.loan_amount_requested) || 0);
  const sanctioned = sanctionableAmount(requested, risk.grade);

  const phi = shapValues(model, x);
  const drivers: Driver[] = phi
    .map((contribution, i) => ({ i, contribution }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, topK)
    .map(({ i, contribution }) => ({
      feature: model.feature_names[i] ?? `feature_${i}`,
      contribution,
      encoded_value: x[i],
      direction: contribution > 0 ? "increases_risk" : "reduces_risk",
    }));

  return {
    probability_of_default: roundTo(risk.probability_of_default, 6),
    grade: risk.grade,
    india_score: risk.india_score,
    repayment_confidence: roundTo(risk.repayment_confidence, 4),
    indicative_apr: risk.indicative_apr,
    requested_amount: requested,
    sanctioned_amount: sanctioned,
    decision: decide(risk.grade, sanctioned),
    drivers,
  };
}
