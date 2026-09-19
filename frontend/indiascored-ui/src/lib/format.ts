/** Presentation helpers shared across the applicant and underwriter views. */

import type { Decision, RiskGrade } from "./types";

export const formatRupees = (amount: number | null | undefined): string =>
  amount === null || amount === undefined
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(amount);

export const formatPercent = (fraction: number | null | undefined, digits = 1): string =>
  fraction === null || fraction === undefined ? "—" : `${(fraction * 100).toFixed(digits)}%`;

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const parsed = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  return Number.isNaN(parsed.getTime())
    ? iso
    : parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

/** Turn an encoded feature name into something a loan officer can read. */
export const humaniseFeature = (feature: string): string =>
  feature
    .replace(/^(num|cat)__/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const GRADE_STYLES: Record<RiskGrade, string> = {
  "A+": "bg-emerald-100 text-emerald-800 border-emerald-200",
  A: "bg-green-100 text-green-800 border-green-200",
  B: "bg-amber-100 text-amber-800 border-amber-200",
  C: "bg-orange-100 text-orange-800 border-orange-200",
  D: "bg-red-100 text-red-800 border-red-200",
};

export const DECISION_STYLES: Record<Decision, string> = {
  Approved: "bg-green-100 text-green-800 border-green-200",
  Review: "bg-amber-100 text-amber-800 border-amber-200",
  Rejected: "bg-red-100 text-red-800 border-red-200",
};

/** Where a score sits on the 300-900 band, as a 0-1 fraction. */
export const scorePosition = (score: number): number =>
  Math.min(Math.max((score - 300) / 600, 0), 1);

export const scoreBandLabel = (score: number): string => {
  if (score >= 750) return "Excellent";
  if (score >= 700) return "Good";
  if (score >= 650) return "Fair";
  if (score >= 600) return "Needs work";
  return "High risk";
};
