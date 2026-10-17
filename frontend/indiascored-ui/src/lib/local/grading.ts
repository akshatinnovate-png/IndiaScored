/** Credit policy, ported from backend/indiascored/scoring/grading.py. */

import type { RiskGrade } from "../types.ts";

const GRADE_LADDER: Array<[number, number, RiskGrade]> = [
  [0.0, 0.05, "A+"],
  [0.05, 0.1, "A"],
  [0.1, 0.2, "B"],
  [0.2, 0.35, "C"],
  [0.35, 1.01, "D"],
];

const EXPOSURE_CAP: Record<RiskGrade, number> = { "A+": 1.0, A: 0.95, B: 0.8, C: 0.55, D: 0.0 };
const INDICATIVE_APR: Record<RiskGrade, number> = { "A+": 10.5, A: 12.5, B: 15.0, C: 19.5, D: 24.0 };

const PD_FLOOR = 0.001;
const PD_CEILING = 0.999;
const SCORE_FLOOR = 300;
const SCORE_CEILING = 900;
const LOGIT_WINDOW: [number, number] = [-7.0, 7.0];

/** Python's round(): half to even, so ported scores match exactly. */
function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function indiaScoreFromPd(pd: number): number {
  const p = Math.min(Math.max(pd, 1e-6), 1 - 1e-6);
  const logOdds = -Math.log(p / (1 - p));
  const [low, high] = LOGIT_WINDOW;
  const position = Math.min(Math.max((logOdds - low) / (high - low), 0), 1);
  return roundHalfEven(SCORE_FLOOR + (SCORE_CEILING - SCORE_FLOOR) * position);
}

export function gradeFromPd(pd: number): RiskGrade {
  for (const [low, high, label] of GRADE_LADDER) {
    if (low <= pd && pd < high) return label;
  }
  return "D";
}

export function sanctionableAmount(requested: number, grade: RiskGrade): number {
  return Math.floor(Math.max(requested, 0) * (EXPOSURE_CAP[grade] ?? 0));
}

export function gradePd(rawPd: number) {
  const pd = Math.min(Math.max(rawPd, PD_FLOOR), PD_CEILING);
  const grade = gradeFromPd(pd);
  return {
    probability_of_default: pd,
    grade,
    india_score: indiaScoreFromPd(pd),
    repayment_confidence: 1 - pd,
    indicative_apr: INDICATIVE_APR[grade] ?? INDICATIVE_APR.D,
  };
}

/** Score thresholds derived from the PD ladder, so blending agrees with grading. */
const SCORE_LADDER: Array<[number, RiskGrade]> = GRADE_LADDER.filter(([, , g]) => g !== "D").map(
  ([, upper, label]) => [indiaScoreFromPd(upper), label],
);

export function blendPortfolio(
  loans: Array<{ india_score?: number | null; repayment_confidence?: number | null; loan_amount_requested?: number | null }>,
) {
  const entries = loans.filter((l) => l.india_score !== null && l.india_score !== undefined);
  if (entries.length === 0) {
    return { india_score: null, grade: null, loan_count: 0, repayment_confidence: null };
  }
  const weights = entries.map((l) => Math.max(Number(l.loan_amount_requested || 1), 1));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const score = entries.reduce((sum, l, i) => sum + Number(l.india_score) * weights[i], 0) / totalWeight;
  const confidence =
    entries.reduce((sum, l, i) => sum + Number(l.repayment_confidence || 0) * weights[i], 0) / totalWeight;

  let grade: RiskGrade = "D";
  for (const [threshold, label] of SCORE_LADDER) {
    if (score >= threshold) {
      grade = label;
      break;
    }
  }
  return {
    india_score: roundTo(score, 2),
    grade,
    loan_count: entries.length,
    repayment_confidence: roundTo(confidence, 4),
  };
}
