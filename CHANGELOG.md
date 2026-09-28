# Changelog

All notable changes to IndiaScored are documented here.

## [2.1.1] — 2026-09-28

### Overview

This release is a ground-up rebuild of the platform, formerly shipped as
**BharatScore**. The scoring model, backend and frontend were all rewritten
from scratch to fix a critical scoring defect and replace a flat, ad-hoc
codebase with a maintainable, layered architecture. If you're upgrading from
any BharatScore release, treat this as a breaking change — the API contracts,
repository layout and model artifact have all changed.

### 🐛 Bug fixes

- **Critical: degenerate model scores every applicant as risk-free.** The
  previously shipped model bundle returned a probability of default (PD) of
  roughly `1e-23` for every applicant regardless of input, which meant every
  application resolved to grade A+ / IndiaScore 900. The model has been
  retrained from a newly generated synthetic population with SMOTE
  rebalancing, Optuna hyperparameter search and isotonic calibration; it now
  produces a real, well-separated score distribution (test ROC-AUC 0.765,
  Brier 0.133).
- **Train/serve feature drift.** Feature engineering used to live in two
  separate places (the training notebook and the serving API) and could
  silently diverge. Both now import the same `derive_features` function, so
  a request is scored with exactly the logic it was trained on.
- **Inconsistent SMS-normalization for single-row requests.** SMS-activity
  features were normalized against the max value in the current batch, so a
  lone applicant scored differently than the same applicant scored inside a
  batch. The normalization ceiling is now a frozen constant
  (`SMS_REFERENCE_CEILING = 60.0`) shared by both paths.
- **Blended headline grade disagreed with the per-application grade.** The
  score-to-grade ladder used for blending an applicant's multiple
  applications into one headline score was hardcoded and out of sync with
  the PD-to-grade bins used elsewhere (e.g. a single A+ application could
  blend down to an A). The ladder is now derived directly from the PD grade
  bins, so the two are always consistent.
- **Broken post-sign-in redirect.** The redirect after sign-in read a
  `data.users` field the backend never returned, leaving new applicants
  stuck looping back into the profile form. It now calls `api.profile.get()`
  and checks the `has_profile` flag returned by the API.
- **Apply form sent values the model didn't understand.** The loan
  application form sent a raw `recharge_pattern` string (`"mostly"`) that
  didn't match the model's expected enum, and sent raw rupee income instead
  of a normalized signal. Both are now mapped explicitly before submission.
- **Non-portable MongoDB queries.** The underwriting review queue used a
  `$lookup` with a `let` clause, which isn't supported by all MongoDB
  deployments/test doubles. Rewritten as two indexed reads joined in Python.
- **Wrong component imported in the sidebar.** The dashboard sidebar
  imported the landing-page CTA button instead of the shared UI button
  component.
- **Hardcoded Clerk key.** The Clerk publishable key was embedded directly
  in source instead of read from configuration, so the app couldn't be
  deployed to a different environment without recompiling. It now reads
  `VITE_CLERK_PUBLISHABLE_KEY` and fails loudly if it's missing.

### ✨ What's new

- **Layered FastAPI backend.** Replaced the flat, monolithic backend with a
  proper package: `routers/` (one per product area), `schemas/` (strict
  Pydantic contracts), `scoring/` (pure credit policy, feature engineering,
  model bundle, scoring engine), `explain/` (SHAP + knowledge base +
  narrator), `repositories/` (the only layer that touches MongoDB), and
  `training/` (synthetic data generation and the training pipeline).
- **Retrained credit model.** A 12,000-applicant synthetic population
  generated from a structural credit model (hand-set log-odds weights,
  interactions, and an intercept solved to hit a 20% baseline default rate)
  feeds a LightGBM classifier with SMOTE, Optuna tuning and isotonic
  calibration.
- **Explainability with graceful fallback.** SHAP identifies the top
  factors behind each decision; those are looked up in a 14-entry credit
  knowledge base and turned into an underwriting remark by a local Mistral
  model via Ollama. If no LLM is available, a deterministic rule-based
  remark is generated instead — an explanation is never simply missing.
- **Credit policy as pure functions.** PD → grade (A+ through D), PD → a
  300-900 IndiaScore, and grade → exposure cap are all pure, independently
  testable functions with no side effects.
- **Feature-organized React frontend.** The frontend moved from a flat
  components directory to `features/` (landing, auth, onboarding,
  psychometric, applications, dashboard, underwriting) plus `shared/` (UI
  primitives, hooks) and `lib/` (a single typed API client, shared types,
  formatting utilities).
- **One typed API client.** `lib/api.ts` replaces roughly 20 hardcoded
  `fetch` calls scattered across components, so any endpoint change now
  touches one file.
- **83 backend tests** covering credit policy, feature engineering, the
  scoring engine, explainability, and the API surface.
- **New README** with an end-to-end demo walkthrough, architecture
  diagram, repository layout, API reference, model performance numbers,
  and scalability notes.

### ⚠️ Breaking changes

- Repository layout, API request/response shapes, and the model artifact
  format have all changed since BharatScore. There is no in-place upgrade
  path — redeploy from this version's `backend/` and
  `frontend/indiascored-ui/` directories and retrain or re-download the
  model bundle.

---

*IndiaScored — Akshat Sarkar*
