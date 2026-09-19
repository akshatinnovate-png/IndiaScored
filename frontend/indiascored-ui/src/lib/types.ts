/**
 * Shapes returned by the IndiaScored backend.
 *
 * These mirror the pydantic schemas in `backend/indiascored/schemas/`;
 * keep the two in step when a contract changes.
 */

export type UserType = "smartphone" | "feature_phone";
export type Region = "urban" | "rural";
export type AgeGroup = "18-30" | "31-50" | "51-70";
export type RechargePattern = "always_on_time" | "sometimes_late" | "often_late";
export type LoanCategory = "education" | "farmer" | "startup" | "personal";

export type RiskGrade = "A+" | "A" | "B" | "C" | "D";
export type Decision = "Approved" | "Review" | "Rejected";
export type ReviewStatus = "approved" | "rejected" | "flagged" | "pending";
export type ApplicationStatus = ReviewStatus | "submitted";

export interface Profile {
  name: string;
  gender: string;
  state: string;
  occupation: string;
}

/** The alternative-data vector the model scores. */
export interface AlternativeData {
  user_type: UserType;
  region: Region;
  age_group: AgeGroup;
  sms_count: number;
  bill_on_time_ratio: number;
  recharge_pattern: RechargePattern;
  recharge_freq: number;
  sim_tenure: number;
  location_stability: number;
  income_signal: number;
  coop_score: number;
  land_verified: 0 | 1;
  psychometric_score: number;
  loan_amount_requested: number;
  loan_category: LoanCategory;
}

/** One SHAP attribution. A positive contribution pushes the PD up. */
export interface Driver {
  feature: string;
  contribution: number;
  encoded_value: number;
  direction: "increases_risk" | "reduces_risk";
}

export interface Narration {
  remark: string;
  generated_by: "mistral" | "rule_based";
  evidence: Array<{
    feature: string;
    label: string;
    contribution: number;
    direction: "increases_risk" | "reduces_risk";
    strength: "strong" | "moderate" | "minor";
    meaning: string;
    reading: string;
  }>;
}

export interface ScoreCard {
  probability_of_default: number;
  grade: RiskGrade;
  india_score: number;
  repayment_confidence: number;
  indicative_apr: number;
  requested_amount: number;
  sanctioned_amount: number;
  decision: Decision;
  drivers: Driver[];
  narration?: Narration | null;
}

export interface Application {
  clerk_user_id: string;
  submitted_at: string;
  alternative_data: AlternativeData;
  consent: boolean;
  status: ApplicationStatus;
  score_card: ScoreCard | null;
  narration: Narration | null;
  review?: {
    remarks: string;
    internal_notes: string;
    reviewer: string;
    decided_at: string;
  };
  notification?: { message: string; issued_at: string; read: boolean };
}

/** An applicant's whole book, collapsed to one headline score. */
export interface PortfolioHeadline {
  india_score: number | null;
  grade: RiskGrade | null;
  loan_count: number;
  repayment_confidence: number | null;
}

export interface PipelineSummary {
  total: number;
  open: number;
  approved: number;
  adverse: number;
  by_status: Record<string, number>;
}

export interface QueueEntry {
  clerk_user_id: string;
  submitted_at: string;
  status: ApplicationStatus;
  name?: string | null;
  loan_amount_requested?: number;
  loan_category?: string;
  india_score?: number | null;
  grade?: RiskGrade | null;
  decision?: Decision | null;
}

export interface UnderwritingQueue {
  pipeline: PipelineSummary;
  grade_distribution: Partial<Record<RiskGrade, number>>;
  applications: QueueEntry[];
}

export interface ApplicantDossier {
  clerk_user_id: string;
  profile: Profile | null;
  psychometric: { score: number; taken_at: string } | null;
  applications: Application[];
}

export interface Notification {
  id: string;
  message: string;
  issued_at: string;
  read: boolean;
  status: ApplicationStatus;
  submitted_at: string;
  remarks: string;
  loan_amount: number;
  loan_category: string;
  india_score: number | null;
  grade: RiskGrade | null;
}

export interface HealthReport {
  status: "healthy" | "degraded";
  model_loaded: boolean;
  explainer_loaded: boolean;
  encoded_features: number;
  knowledge_base_entries: number;
  llm_available: boolean;
  model_error: string | null;
}
