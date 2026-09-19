# IndiaScored — AI Credit Risk Platform (Alternative Data + Explainable AI)

 Submitted to HackDevengers 2.0 by Akshat Sarkar.

IndiaScored scores the creditworthiness of people who have **no formal credit history** — India's ~190M unbanked and millions more underbanked — using **alternative data** instead of a CIBIL record, and explains every decision so a human underwriter can trust it.

---

## The problem

A lender can't assess someone with no bank statements, no CIBIL score, no salary slips. So those people get pushed to informal lenders at predatory rates. But they *do* leave digital footprints — how regularly they recharge their phone, whether they pay utility bills on time, how long they've held a SIM, how stable their location is. IndiaScored turns those footprints into a defensible credit decision.

## What it does, end to end

1. **A user onboards** — Aadhaar OCR + phone verification, then fills a profile (telecom, utility, demographic signals) and takes a short **psychometric test** (timed and randomised so it can't be gamed).
2. **The backend runs the ML model** — a calibrated LightGBM classifier outputs a **Probability of Default (PD)**.
3. **PD becomes a decision** — PD maps to a risk tier (A+ → D), an alternative CIBIL-style score (300–900), and a sanctioned loan amount scaled by tier.
4. **The decision is explained** — SHAP identifies the top factors that drove the score; a local **Mistral LLM (via Ollama)** turns those raw SHAP values into a plain-English remark for the loan officer.
5. **An admin reviews** — a dashboard shows the pipeline, risk distribution, per-applicant SHAP breakdown and the AI remark, and the admin approves, rejects or flags.

## Architecture
┌───────────────────────────── Frontend (React 19 + TypeScript, Vite) ─────────────────────────────┐
│ User portal (Clerk auth) · Psychometric test · Apply form · Admin dashboard · SHAP charts │
└───────────────────────────────────────────┬───────────────────────────────────────────────────────┘
│ REST (axios)
┌───────────────────────────────────────────┴──────────── Backend (FastAPI) ───────────────────────┐
│ Profile · Onboard · Predict · Psychometric · Admin summary · Generate-insight · Notifications │
│ │
│ ML pipeline: preprocessor → calibrated LightGBM → PD → tier/score/sanction → SHAP explainer │
│ RAG layer: top SHAP features → feature knowledge base → Mistral (Ollama) → NL remark │
└───────────────────────────────────────────┬───────────────────────────────────────────────────────┘
│
MongoDB (users, applications, psychometric, notifications)


## Codebase walkthrough

### Backend (`backend/`, FastAPI + Python)

- **`app.py`** (~860 lines) — the API. Loads the model bundle once at startup, connects to MongoDB, and exposes the routes below. Also holds the RAG logic: `retrieve_explanations()` looks up each top SHAP feature in a knowledge base, and `ollama_generate()` shells out to a local Mistral model to write the underwriter's remark.
- **`inference_utils.py`** — the scoring core, pure and testable. `pd_to_alt_cibil()` maps a probability to a 300–900 score via a logit transform; `pd_to_tier()` bins PD into A+…D; `sanction_amount()` scales the requested loan by tier; `infer_user()` ties it together — feature-engineers the row, predicts PD, computes tier/score/eligibility and returns the top-k SHAP features.
- **`models.py`** — `InferenceModel`, a thin wrapper pairing the preprocessor with the calibrated classifier so `predict_proba` is one call.
- **`artifacts/`** — the trained model, serialized: `lgbm_raw_model.pkl` (raw LightGBM), `calibrated_clf.pkl` (probability-calibrated), `preprocessor.pkl`, `feature_names.pkl`, `inference_wrapper.pkl`, and a bundled `bharatscore_pipeline_bundle.pkl` that also carries the SHAP explainer.
- **`BharatScore_DataGeneration.ipynb`** — the notebook that generates the synthetic training data and trains the pipeline (SMOTE for class imbalance, Optuna for hyperparameter tuning).

**API routes**

| Route | Method | Purpose |
|---|---|---|
| `/onboard`, `/profile` | POST/GET | Create and read the applicant profile |
| `/predict`, `/predict/{user_id}` | POST/GET | Run the model, return PD, tier, score, decision, SHAP |
| `/save-psychometric`, `/psychometric-status` | POST/GET | Store and check the behavioural test |
| `/admin/applications-summary` | GET | Aggregate pipeline stats for the dashboard |
| `/admin/applications/{clerk_user_id}` | GET | Full per-applicant view with SHAP |
| `/admin/generate-insight`, `/generate-remark` | POST | RAG: SHAP → Mistral → natural-language remark |
| `/user/notifications*` | GET/POST | Applicant notifications (list, count, mark-read) |
| `/health`, `/` | GET | Liveness + whether model and explainer loaded |

### Frontend (`frontend/bharatscore-ui/`, React 19 + TypeScript + Vite)

- **Auth** — Clerk. **Data fetching** — TanStack Query over axios. **UI** — Radix primitives + Tailwind, Framer Motion, Lucide icons. **Charts** — Recharts (SHAP waterfalls, risk distribution). **Face check** — face-api.js during verification.
- **Key screens** — `LandingPage`, `SignInPage`/`SignUpPage`, `ProfileForm`, `psychometricTest`, `ApplyForm`, `Dashboard`/`CreditRiskDashboard` (applicant), and `AdminDashboard`/`Applications` (underwriter). `dashboard/BharatScore.tsx` renders the score gauge; `forms/` holds the loan and score-generation flows.

## Data model (MongoDB)

One `bharatscore` database: `users` (profile + latest score), applications, psychometric results and notifications. Admin summary stats are computed with MongoDB aggregation pipelines rather than in Python, so they stay fast as data grows.

## Running it

**Backend**
```bash
cd backend
python -m venv venv && venv\Scripts\activate      # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
# set MONGO_URI in a .env file; ensure artifacts/ is populated
uvicorn app:app --reload --port 8000              # Swagger at http://localhost:8000/docs
ollama pull mistral                               # optional, enables AI remarks
```

**Frontend**
```bash
cd frontend/bharatscore-ui
npm install
# set VITE_CLERK_PUBLISHABLE_KEY and VITE_API_BASE_URL in .env
npm run dev
```

## Model performance

Trained on a synthetic ~5,000-profile dataset built to simulate thin-file applicants and edge-case behaviour. Split 70/10/20, SMOTE + class weights for the imbalance, Optuna (Bayesian) tuning.

- ROC-AUC **0.64**, PR-AUC **0.32**, Brier **0.19** (well-calibrated), F1 (defaults) **0.71**.
- Top predictive features (SHAP): cooperative/community score, psychometric result, SMS activity and bill punctuality, SIM tenure and land verification.

These are baseline numbers on deliberately hard synthetic data; they're expected to rise on real, higher-volume production data — the pipeline is built to retrain and scale.

## Scalability

- **Decoupled services** — React frontend and FastAPI backend scale independently; the model layer can be scaled on its own behind the API.
- **Async by default** — FastAPI handles concurrent inferences and DB calls without blocking.
- **Calibrated, versioned model artifacts** — the model is a swappable `.pkl` bundle, so retraining is a redeploy of one file, not a code change.
- **DB-side aggregation** — admin analytics run as MongoDB pipelines, so dashboards stay responsive as applications grow.
- **Stateless API** — no server-side session state, so it scales horizontally behind a load balancer; ready to containerize (Docker) and run multiple replicas.

## Future work

Sequential deep-learning models (LSTMs) for repayment time-series, generative psychometric question banks to fully defeat gaming, and Kafka-based real-time telecom streaming into the scoring engine.
