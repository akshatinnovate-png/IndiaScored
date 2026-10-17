/**
 * The single place the UI talks to the IndiaScored backend.
 *
 * With VITE_API_BASE_URL set, every call goes over HTTP to the FastAPI
 * service. Without it — the GitHub Pages build — the same calls run against
 * the in-browser backend in `lib/local/`, which scores with the exported
 * model and stores data in localStorage, so the app needs no server at all.
 */

import type {
  AlternativeData,
  ApplicantDossier,
  Application,
  HealthReport,
  Notification,
  PortfolioHeadline,
  Profile,
  ReviewStatus,
  ScoreCard,
  UnderwritingQueue,
} from "./types";

import { LocalApiError, localApi } from "./local/backend";

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || null;

/** True when the app runs entirely in the browser, with no backend. */
export const IS_LOCAL_BACKEND = API_BASE_URL === null;

/** An error carrying the backend's own message, so the UI can show it. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      ...init,
    });
  } catch (cause) {
    throw new ApiError(
      `Cannot reach the IndiaScored API at ${API_BASE_URL}. Is the backend running?`,
      0,
      cause,
    );
  }

  if (!response.ok) {
    // FastAPI puts the reason in `detail`, which may be a string or a
    // validation-error array.
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("; ")
          : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
});

const remoteApi = {
  /** Liveness plus which components actually loaded. */
  health: () => request<HealthReport>("/health"),

  profile: {
    get: (clerkUserId: string) =>
      request<{ profile: Profile | null; has_profile: boolean }>(
        `/profile?clerk_user_id=${encodeURIComponent(clerkUserId)}`,
      ),
    save: (clerkUserId: string, profile: Profile) =>
      request<{ status: string }>("/profile", json({ clerk_user_id: clerkUserId, ...profile })),
  },

  psychometric: {
    status: (clerkUserId: string) =>
      request<{ completed: boolean; score: number | null; taken_at: string | null }>(
        `/psychometric/status?clerk_user_id=${encodeURIComponent(clerkUserId)}`,
      ),
    save: (clerkUserId: string, score: number) =>
      request<{ status: string; score: number; taken_at: string }>(
        "/psychometric",
        json({ clerk_user_id: clerkUserId, psychometric_score: score }),
      ),
  },

  applications: {
    /** Submit and score in one call — the response already carries the decision. */
    submit: (clerkUserId: string, data: AlternativeData, consent = true) =>
      request<{ status: string; submitted_at: string; score_card: ScoreCard }>(
        "/applications",
        json({ clerk_user_id: clerkUserId, consent, ...data }),
      ),
    list: (clerkUserId: string) =>
      request<{ applications: Application[]; headline: PortfolioHeadline }>(
        `/applications/${encodeURIComponent(clerkUserId)}`,
      ),
    get: (clerkUserId: string, submittedAt: string) =>
      request<Application>(
        `/applications/${encodeURIComponent(clerkUserId)}/${encodeURIComponent(submittedAt)}`,
      ),
  },

  scoring: {
    /** Score a vector without storing it — used by the what-if tool. */
    score: (data: AlternativeData) => request<ScoreCard>("/score", json(data)),
    explain: (data: AlternativeData) => request<ScoreCard>("/score/explained", json(data)),
    rescore: (clerkUserId: string, submittedAt: string) =>
      request<{ score_card: ScoreCard }>(
        "/score/rescore",
        json({ clerk_user_id: clerkUserId, submitted_at: submittedAt }),
      ),
  },

  notifications: {
    list: (clerkUserId: string) =>
      request<{ notifications: Notification[] }>(`/notifications/${encodeURIComponent(clerkUserId)}`),
    unreadCount: (clerkUserId: string) =>
      request<{ unread_count: number }>(
        `/notifications/${encodeURIComponent(clerkUserId)}/unread-count`,
      ),
    markRead: (clerkUserId: string, submittedAt?: string) =>
      request<{ marked_read: number }>(
        `/notifications/${encodeURIComponent(clerkUserId)}/read` +
          (submittedAt ? `?submitted_at=${encodeURIComponent(submittedAt)}` : ""),
        { method: "PATCH" },
      ),
  },

  underwriting: {
    queue: () => request<UnderwritingQueue>("/underwriting/queue"),
    dossier: (clerkUserId: string) =>
      request<ApplicantDossier>(`/underwriting/applicants/${encodeURIComponent(clerkUserId)}`),
    /** RAG: SHAP drivers -> knowledge base -> Mistral -> underwriter's remark. */
    remark: (clerkUserId: string, submittedAt: string) =>
      request<{ score_card: ScoreCard; narration: ScoreCard["narration"] }>(
        "/underwriting/remark",
        json({ clerk_user_id: clerkUserId, submitted_at: submittedAt }),
      ),
    decide: (
      clerkUserId: string,
      submittedAt: string,
      decision: { status: ReviewStatus; remarks?: string; internal_notes?: string; reviewer?: string },
    ) =>
      request<{ status: ReviewStatus; applicant_message: string }>(
        `/underwriting/applications/${encodeURIComponent(clerkUserId)}/${encodeURIComponent(submittedAt)}`,
        { method: "PATCH", body: JSON.stringify(decision) },
      ),
  },
};

/** Re-raise the local backend's errors as the ApiError the UI already handles. */
function withApiErrors<T extends object>(target: T): T {
  return Object.fromEntries(
    Object.entries(target).map(([key, value]) => [
      key,
      typeof value === "function"
        ? async (...args: unknown[]) => {
            try {
              return await value(...args);
            } catch (error) {
              if (error instanceof LocalApiError) throw new ApiError(error.message, error.status);
              throw error;
            }
          }
        : withApiErrors(value as object),
    ]),
  ) as T;
}

export const api: typeof remoteApi = IS_LOCAL_BACKEND
  ? withApiErrors(localApi as unknown as typeof remoteApi)
  : remoteApi;
