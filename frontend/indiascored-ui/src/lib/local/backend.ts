/**
 * The IndiaScored backend, running in the browser.
 *
 * Mirrors the FastAPI routes one for one — same response shapes, same
 * errors — with localStorage standing in for MongoDB and the exported model
 * standing in for the Python scoring engine. Used whenever the build has no
 * VITE_API_BASE_URL, which is how the GitHub Pages site runs.
 */

import type {
  AlternativeData,
  ApplicantDossier,
  Application,
  HealthReport,
  Notification,
  PortfolioHeadline,
  Profile,
  QueueEntry,
  ReviewStatus,
  ScoreCard,
  UnderwritingQueue,
} from "../types";
import { scoreRecord } from "./engine";
import { blendPortfolio } from "./grading";
import type { ModelJson } from "./model";
import { narrate } from "./narrator";
import knowledgeBase from "./feature-knowledge-base.json";

/** Thrown with the same status codes the HTTP backend would use. */
export class LocalApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// --- Model ------------------------------------------------------------------

let modelPromise: Promise<ModelJson> | null = null;

function loadModel(): Promise<ModelJson> {
  modelPromise ??= fetch(`${import.meta.env.BASE_URL}model/indiascored-model.json`).then((res) => {
    if (!res.ok) throw new LocalApiError("The scoring model could not be loaded.", 503);
    return res.json() as Promise<ModelJson>;
  });
  modelPromise.catch(() => {
    modelPromise = null;
  });
  return modelPromise;
}

async function score(data: Record<string, unknown>): Promise<ScoreCard> {
  return scoreRecord(await loadModel(), data);
}

// --- Storage ----------------------------------------------------------------

interface ProfileDoc {
  profile?: Profile;
  psychometric?: { score: number; taken_at: string };
}

interface Database {
  profiles: Record<string, ProfileDoc>;
  applications: Application[];
}

const STORAGE_KEY = "indiascored_db_v1";
let memory: Database | null = null;

function read(): Database {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) memory = JSON.parse(raw) as Database;
  } catch {
    // Unreadable or blocked storage: start empty and keep the data in memory.
  }
  memory ??= { profiles: {}, applications: [] };
  return memory;
}

function write(db: Database): void {
  memory = db;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage full or blocked: the session still works from memory.
  }
}

let lastStamp = "";

/** Canonical ISO-8601 (no zone), unique per call — an application's identity. */
function nowIso(): string {
  let stamp = new Date().toISOString().replace("Z", "");
  while (stamp <= lastStamp) {
    stamp = new Date(Date.parse(`${lastStamp}Z`) + 1).toISOString().replace("Z", "");
  }
  lastStamp = stamp;
  return stamp;
}

const byNewest = (a: Application, b: Application) => b.submitted_at.localeCompare(a.submitted_at);

function applicationsOf(db: Database, userId: string): Application[] {
  return db.applications.filter((a) => a.clerk_user_id === userId).sort(byNewest);
}

function findApplication(db: Database, userId: string, submittedAt: string): Application {
  const app = db.applications.find((a) => a.clerk_user_id === userId && a.submitted_at === submittedAt);
  if (!app) throw new LocalApiError("Application not found.", 404);
  return app;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// --- Sample book, so the underwriting desk has files on first visit ---------

const SEED_APPLICANTS: Array<{ id: string; profile: Profile; psychometric: number; data: AlternativeData; review?: ReviewStatus }> = [
  {
    id: "sample-lakshmi",
    profile: { name: "Lakshmi Devi", gender: "Female", state: "Tamil Nadu", occupation: "Farmer" },
    psychometric: 0.82,
    data: {
      user_type: "feature_phone", region: "rural", age_group: "31-50", sms_count: 12,
      bill_on_time_ratio: 0.95, recharge_pattern: "always_on_time", recharge_freq: 1.0, sim_tenure: 96,
      location_stability: 0.9, income_signal: 0.88, coop_score: 86, land_verified: 1,
      psychometric_score: 0.82, loan_amount_requested: 60000, loan_category: "farmer",
    },
    review: "approved",
  },
  {
    id: "sample-arjun",
    profile: { name: "Arjun Mehta", gender: "Male", state: "Maharashtra", occupation: "Small Business Owner" },
    psychometric: 0.71,
    data: {
      user_type: "smartphone", region: "urban", age_group: "18-30", sms_count: 44,
      bill_on_time_ratio: 0.84, recharge_pattern: "always_on_time", recharge_freq: 1.0, sim_tenure: 40,
      location_stability: 0.82, income_signal: 0.76, coop_score: 55, land_verified: 0,
      psychometric_score: 0.71, loan_amount_requested: 150000, loan_category: "startup",
    },
  },
  {
    id: "sample-fatima",
    profile: { name: "Fatima Shaikh", gender: "Female", state: "Gujarat", occupation: "Self-employed" },
    psychometric: 0.58,
    data: {
      user_type: "smartphone", region: "urban", age_group: "31-50", sms_count: 28,
      bill_on_time_ratio: 0.66, recharge_pattern: "sometimes_late", recharge_freq: 0.5, sim_tenure: 30,
      location_stability: 0.7, income_signal: 0.6, coop_score: 48, land_verified: 0,
      psychometric_score: 0.58, loan_amount_requested: 90000, loan_category: "personal",
    },
  },
  {
    id: "sample-ravi",
    profile: { name: "Ravi Kumar", gender: "Male", state: "Bihar", occupation: "Daily Wage Worker" },
    psychometric: 0.36,
    data: {
      user_type: "feature_phone", region: "rural", age_group: "18-30", sms_count: 4,
      bill_on_time_ratio: 0.35, recharge_pattern: "often_late", recharge_freq: 0.2, sim_tenure: 6,
      location_stability: 0.45, income_signal: 0.25, coop_score: 32, land_verified: 0,
      psychometric_score: 0.36, loan_amount_requested: 120000, loan_category: "startup",
    },
    review: "rejected",
  },
  {
    id: "sample-priya",
    profile: { name: "Priya Nair", gender: "Female", state: "Kerala", occupation: "Student" },
    psychometric: 0.77,
    data: {
      user_type: "smartphone", region: "urban", age_group: "18-30", sms_count: 36,
      bill_on_time_ratio: 0.9, recharge_pattern: "always_on_time", recharge_freq: 1.0, sim_tenure: 52,
      location_stability: 0.86, income_signal: 0.7, coop_score: 62, land_verified: 0,
      psychometric_score: 0.77, loan_amount_requested: 80000, loan_category: "education",
    },
  },
];

let seeding: Promise<void> | null = null;

function ensureSeeded(): Promise<void> {
  seeding ??= (async () => {
    const db = read();
    if (db.applications.some((a) => a.clerk_user_id.startsWith("sample-"))) return;
    const model = await loadModel();
    for (const seed of SEED_APPLICANTS) {
      const takenAt = nowIso();
      db.profiles[seed.id] = { profile: seed.profile, psychometric: { score: seed.psychometric, taken_at: takenAt } };
      const card = scoreRecord(model, seed.data);
      const app: Application = {
        clerk_user_id: seed.id,
        submitted_at: nowIso(),
        alternative_data: seed.data,
        consent: true,
        status: "pending",
        score_card: card,
        narration: null,
      };
      if (seed.review) {
        Object.assign(app, decided(seed.review, "Sample file reviewed.", "", "Sample underwriter"));
      }
      db.applications.push(app);
    }
    write(db);
  })();
  seeding.catch(() => {
    seeding = null;
  });
  return seeding;
}

// --- Underwriting decisions ---------------------------------------------------

const APPLICANT_MESSAGES: Record<ReviewStatus, string> = {
  approved:
    "Your loan application has been approved. Please visit your nearest branch " +
    "with your identity documents to complete verification and disbursal.",
  rejected:
    "Your loan application could not be approved at this time. You may reapply " +
    "after strengthening the factors listed in your score breakdown.",
  flagged:
    "Your application needs an additional check. Our team will contact you shortly with the next steps.",
  pending: "Your application is under review. We will update you as soon as a decision is made.",
};

function decided(status: ReviewStatus, remarks: string, internalNotes: string, reviewer: string): Partial<Application> {
  const at = nowIso();
  return {
    status,
    review: { remarks, internal_notes: internalNotes, reviewer, decided_at: at },
    notification: { message: APPLICANT_MESSAGES[status] ?? APPLICANT_MESSAGES.pending, issued_at: at, read: false },
  };
}

// --- Routes -------------------------------------------------------------------

const OPEN = ["submitted", "pending"];
const ADVERSE = ["rejected", "flagged"];

export const localApi = {
  health: async (): Promise<HealthReport> => {
    try {
      const model = await loadModel();
      return {
        status: "healthy",
        model_loaded: true,
        explainer_loaded: true,
        encoded_features: model.feature_names.length,
        knowledge_base_entries: Object.keys(knowledgeBase).length,
        llm_available: false,
        model_error: null,
      };
    } catch (error) {
      return {
        status: "degraded",
        model_loaded: false,
        explainer_loaded: false,
        encoded_features: 0,
        knowledge_base_entries: Object.keys(knowledgeBase).length,
        llm_available: false,
        model_error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  profile: {
    get: async (userId: string) => {
      const profile = read().profiles[userId]?.profile ?? null;
      return { profile: profile ? clone(profile) : null, has_profile: profile !== null };
    },
    save: async (userId: string, profile: Profile) => {
      const db = read();
      db.profiles[userId] = {
        ...db.profiles[userId],
        profile: { name: profile.name, gender: profile.gender, state: profile.state, occupation: profile.occupation },
      };
      write(db);
      return { status: "stored" };
    },
  },

  psychometric: {
    status: async (userId: string) => {
      const result = read().profiles[userId]?.psychometric;
      return result ? { completed: true, ...result } : { completed: false, score: null, taken_at: null };
    },
    save: async (userId: string, value: number) => {
      if (!(value >= 0 && value <= 1)) throw new LocalApiError("psychometric_score must be between 0 and 1.", 422);
      const db = read();
      const result = { score: value, taken_at: nowIso() };
      db.profiles[userId] = { ...db.profiles[userId], psychometric: result };
      write(db);
      return { status: "saved", ...result };
    },
  },

  applications: {
    submit: async (userId: string, data: AlternativeData, consent = true) => {
      if (!consent) throw new LocalApiError("Alternative-data processing requires explicit consent.", 400);
      const card = await score(data as unknown as Record<string, unknown>);
      const db = read();
      const app: Application = {
        clerk_user_id: userId,
        submitted_at: nowIso(),
        alternative_data: clone(data),
        consent,
        status: "pending",
        score_card: card,
        narration: null,
      };
      db.applications.push(app);
      write(db);
      return { status: "scored", submitted_at: app.submitted_at, score_card: clone(card) };
    },
    list: async (userId: string): Promise<{ applications: Application[]; headline: PortfolioHeadline }> => {
      const applications = applicationsOf(read(), userId);
      if (applications.length === 0) throw new LocalApiError("No applications found for this applicant.", 404);
      const headline = blendPortfolio(
        applications.map((a) => ({
          india_score: a.score_card?.india_score,
          repayment_confidence: a.score_card?.repayment_confidence,
          loan_amount_requested: a.alternative_data?.loan_amount_requested,
        })),
      );
      return { applications: clone(applications), headline };
    },
    get: async (userId: string, submittedAt: string) => clone(findApplication(read(), userId, submittedAt)),
  },

  scoring: {
    score: (data: AlternativeData) => score(data as unknown as Record<string, unknown>),
    explain: async (data: AlternativeData): Promise<ScoreCard> => {
      const card = await score(data as unknown as Record<string, unknown>);
      return { ...card, narration: narrate(card) };
    },
    rescore: async (userId: string, submittedAt: string) => {
      const db = read();
      const app = findApplication(db, userId, submittedAt);
      app.score_card = await score(app.alternative_data as unknown as Record<string, unknown>);
      write(db);
      return { score_card: clone(app.score_card) };
    },
  },

  notifications: {
    list: async (userId: string): Promise<{ notifications: Notification[] }> => {
      const notifications = applicationsOf(read(), userId)
        .filter((a) => a.notification)
        .sort((a, b) => b.notification!.issued_at.localeCompare(a.notification!.issued_at))
        .map((a) => ({
          id: `${userId}::${a.submitted_at}`,
          message: a.notification!.message,
          issued_at: a.notification!.issued_at,
          read: a.notification!.read,
          status: a.status,
          submitted_at: a.submitted_at,
          remarks: a.review?.remarks ?? "",
          loan_amount: a.alternative_data?.loan_amount_requested ?? 0,
          loan_category: a.alternative_data?.loan_category ?? "",
          india_score: a.score_card?.india_score ?? null,
          grade: a.score_card?.grade ?? null,
        }));
      return { notifications };
    },
    unreadCount: async (userId: string) => ({
      unread_count: applicationsOf(read(), userId).filter((a) => a.notification && !a.notification.read).length,
    }),
    markRead: async (userId: string, submittedAt?: string) => {
      const db = read();
      let marked = 0;
      for (const app of db.applications) {
        if (app.clerk_user_id !== userId || !app.notification || app.notification.read) continue;
        if (submittedAt && app.submitted_at !== submittedAt) continue;
        app.notification.read = true;
        marked += 1;
      }
      write(db);
      return { marked_read: marked };
    },
  },

  underwriting: {
    queue: async (): Promise<UnderwritingQueue> => {
      await ensureSeeded();
      const db = read();
      const pipeline = { total: 0, open: 0, approved: 0, adverse: 0, by_status: {} as Record<string, number> };
      const grades: UnderwritingQueue["grade_distribution"] = {};
      for (const app of db.applications) {
        const status = app.status || "submitted";
        pipeline.total += 1;
        pipeline.by_status[status] = (pipeline.by_status[status] ?? 0) + 1;
        if (OPEN.includes(status)) pipeline.open += 1;
        else if (status === "approved") pipeline.approved += 1;
        else if (ADVERSE.includes(status)) pipeline.adverse += 1;
        const grade = app.score_card?.grade;
        if (grade) grades[grade] = (grades[grade] ?? 0) + 1;
      }
      const applications: QueueEntry[] = [...db.applications]
        .sort(byNewest)
        .slice(0, 100)
        .map((app) => ({
          clerk_user_id: app.clerk_user_id,
          submitted_at: app.submitted_at,
          status: app.status || "submitted",
          name: db.profiles[app.clerk_user_id]?.profile?.name ?? null,
          loan_amount_requested: app.alternative_data?.loan_amount_requested ?? 0,
          loan_category: app.alternative_data?.loan_category ?? "",
          india_score: app.score_card?.india_score ?? null,
          grade: app.score_card?.grade ?? null,
          decision: app.score_card?.decision ?? null,
        }));
      return { pipeline, grade_distribution: grades, applications };
    },
    dossier: async (userId: string): Promise<ApplicantDossier> => {
      await ensureSeeded();
      const db = read();
      const applications = applicationsOf(db, userId);
      if (applications.length === 0) throw new LocalApiError("No applications found for this applicant.", 404);
      for (const app of applications) {
        if (!app.score_card) app.score_card = await score(app.alternative_data as unknown as Record<string, unknown>);
      }
      write(db);
      return {
        clerk_user_id: userId,
        profile: clone(db.profiles[userId]?.profile ?? null),
        psychometric: clone(db.profiles[userId]?.psychometric ?? null),
        applications: clone(applications),
      };
    },
    remark: async (userId: string, submittedAt: string) => {
      const db = read();
      const app = findApplication(db, userId, submittedAt);
      app.score_card ??= await score(app.alternative_data as unknown as Record<string, unknown>);
      const name = db.profiles[userId]?.profile?.name || "the applicant";
      app.narration = narrate(app.score_card, name);
      write(db);
      return { score_card: clone(app.score_card), narration: clone(app.narration) };
    },
    decide: async (
      userId: string,
      submittedAt: string,
      decision: { status: ReviewStatus; remarks?: string; internal_notes?: string; reviewer?: string },
    ) => {
      const db = read();
      const app = findApplication(db, userId, submittedAt);
      Object.assign(app, decided(decision.status, decision.remarks ?? "", decision.internal_notes ?? "", decision.reviewer ?? ""));
      write(db);
      return { status: decision.status, applicant_message: app.notification!.message };
    },
  },
};
