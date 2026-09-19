# IndiaScored — AI Credit Risk on Alternative Data

**Author: Akshat Sarkar**

IndiaScored scores the creditworthiness of people who have **no formal credit
history** — India's ~190 million unbanked and millions more underbanked — using
alternative data instead of a bureau record, and explains every decision in
language a loan officer can defend.

---

## The problem

A lender cannot assess someone with no bank statement, no bureau score and no
salary slip, so those people are pushed to informal lenders at predatory rates.
But they *do* leave digital footprints: how reliably they recharge a phone,
whether utility bills are paid on time, how long they have held the same SIM,
how settled their location is, how they stand in their cooperative or self-help
group. IndiaScored turns those footprints into a defensible credit decision.

IndiaScored — super simple explanation

Imagine Rahul wants a ₹20,000 loan, but he has:

❌ No credit score
❌ No previous loan
❌ No salary slip
❌ Little or no formal banking history

So a bank thinks: “We don't have enough information to know whether Rahul will repay us.”

IndiaScored tries to solve this.

How?

Instead of looking only at traditional credit history, it looks at other signals that may show financial reliability, such as:

📱 Does he regularly recharge his phone?
💡 Does he pay electricity/utility bills on time?
📲 Has he kept the same SIM for a long time?
🏠 Has he lived in the same area for a long time?
🤝 Does he have a stable record in a cooperative or self-help group?

The AI combines these signals and produces something like:

IndiaScored: Low / Medium / High estimated credit risk

But the important part is that it doesn't just say “yes” or “no.”

It also explains why:

“This applicant has consistently paid utility bills on time and has maintained the same mobile connection for 4 years. These factors contributed positively to the assessment.”

So a loan officer can understand and defend the decision rather than blindly trusting a mysterious AI score.

In one sentence:

IndiaScored is like giving a person with no credit history a “financial reputation” based on reliable alternative signals, then explaining how the AI reached its decision.

## What it does, end to end

1. **Onboarding** — Aadhaar OCR and phone verification, a short profile, and a
   timed behavioural assessment that is randomised so it cannot be coached.
2. **Scoring** — a calibrated LightGBM classifier returns a probability of
   default (PD) for the applicant's alternative-data vector.
3. **Decision** — PD maps to a risk grade (A+ → D), a 300-900 **IndiaScore**, an
   indicative rate and a sanctionable amount capped by grade.
4. **Explanation** — SHAP identifies the factors that moved the decision; those
   factors are looked up in a credit-domain knowledge base and a local Mistral
   model (via Ollama) writes the underwriter's remark. With no LLM installed, a
   deterministic rule-based remark is produced instead — the explanation is
   never simply missing.
5. **Review** — an underwriter sees the pipeline, the grade mix, the per-file
   SHAP breakdown and the remark, then approves, rejects or flags. The applicant
   is notified automatically.

## Architecture

```
┌──────────── Frontend — React 19 + TypeScript + Vite ────────────┐
│  features/                                                       │
│    landing · auth · onboarding · psychometric                    │
│    applications · dashboard · underwriting · support             │
│  lib/api.ts — the single typed client for every backend call     │
└───────────────────────────┬──────────────────────────────────────┘
                            │ REST (fetch, typed)
┌───────────────────────────┴──────── Backend — FastAPI ───────────┐
│  routers/       one per product area, behind an app factory      │
│  schemas/       pydantic contracts, strict enums                 │
│  scoring/       grading (pure policy) · features · bundle · engine│
│  explain/       knowledge base (retrieval) · narrator (generation)│
│  repositories/  the only code that touches MongoDB               │
│  training/      data synthesis + training pipeline               │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                    MongoDB — one `applicants` collection
```

## Repository layout

```
backend/
  indiascored/         the FastAPI application package
  artifacts/           the serialized model bundle
  tests/               83 tests — credit policy, features, engine, explain, API
  requirements.txt     runtime dependencies
  requirements-training.txt  extras for the notebook
notebooks/
  IndiaScored_Model_Development.ipynb   data generation → training → export
frontend/indiascored-ui/
  src/features/        one folder per part of the product
  src/shared/          ui primitives and hooks
  src/lib/             api client, types, formatting
```

## Running it

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # set MONGO_URI
uvicorn indiascored.main:app --reload --port 8000
```

Swagger is at http://localhost:8000/docs. `GET /health` reports whether the
model, the SHAP explainer and the local LLM each loaded.

Optional, for LLM-written remarks rather than the rule-based fallback:

```bash
ollama pull mistral
```

### Frontend

```bash
cd frontend/indiascored-ui
npm install
cp .env.example .env          # set VITE_CLERK_PUBLISHABLE_KEY and VITE_API_BASE_URL
npm run dev
```

### Tests

```bash
cd backend && pytest                       # 83 tests
cd frontend/indiascored-ui && npm run build   # typecheck + production build
```

## API

| Route | Method | Purpose |
|---|---|---|
| `/profile` | POST / GET | Create and read the applicant profile |
| `/psychometric`, `/psychometric/status` | POST / GET | Store and check the behavioural assessment |
| `/applications` | POST | Submit an application — scored in the same call |
| `/applications/{user}` | GET | Full history plus the blended headline score |
| `/score`, `/score/explained` | POST | Score a vector, with or without a written remark |
| `/score/rescore` | POST | Re-run the current model over a stored application |
| `/underwriting/queue` | GET | Pipeline stats, grade mix and the review queue |
| `/underwriting/applicants/{user}` | GET | The full applicant dossier |
| `/underwriting/remark` | POST | RAG: SHAP → knowledge base → Mistral → remark |
| `/underwriting/applications/{user}/{ts}` | PATCH | Record a decision and notify the applicant |
| `/notifications/{user}` | GET / PATCH | List, count and mark notifications read |
| `/health`, `/` | GET | Readiness, component by component |

## The model

Trained on a 12,000-applicant synthetic population. No public dataset covers
people with *no* bureau record — anyone in a lending dataset was already
lendable — so the population is simulated from a structural model: plausible
marginals per signal, hand-set log-odds weights encoding credit priors,
non-linear interactions, noise, and an intercept solved numerically to hit a
20% default rate.

Pipeline: feature engineering shared with the serving code → impute/scale/one-hot
→ SMOTE on the training fold only → Optuna (TPE) tuning against validation
ROC-AUC → isotonic calibration on a held-out fold → SHAP TreeExplainer.

Held-out test performance:

| Metric | Raw booster | Calibrated |
|---|---|---|
| ROC-AUC | 0.769 | 0.765 |
| PR-AUC (no-skill 0.20) | 0.506 | 0.499 |
| Brier | 0.150 | **0.133** |

Calibration is the number that matters most: the PD becomes a rupee amount, so
it has to mean what it says. The validation fold is deliberately not reported —
the calibrator was fitted on it, so any score there is in-sample.

Top SHAP drivers: inferred income stability, utility bill punctuality,
psychometric result, cooperative standing, land verification, recharge
regularity.

**These numbers describe the pipeline, not the Indian credit market.** The
ground truth is generated, so what transfers to production is the machinery —
the features, the calibration, the explanation layer — not the AUC.

## Scalability

- **Decoupled services.** The React frontend and the FastAPI backend scale
  independently, and the model layer can be scaled behind the API on its own.
- **Stateless API.** No server-side session state, so it scales horizontally
  behind a load balancer.
- **Swappable model artifact.** The bundle is one `.pkl` read from
  `MODEL_BUNDLE_PATH`; retraining is a file drop, not a code change, and a
  missing artifact degrades to a clear 503 instead of taking the API down.
- **Database-side aggregation.** Pipeline stats and the grade mix are computed
  by MongoDB, over indexed fields, so dashboards stay fast as the book grows.
- **Scoring on submit.** Files arrive in the underwriting queue already scored,
  so no work piles up waiting for someone to open them.

## Future work

- Sequential models (LSTM / temporal transformers) over recharge and bill
  histories, reading an applicant's trajectory rather than a snapshot.
- Generative psychometric item banks, so no two applicants see the same
  questions and the assessment cannot be coached.
- Kafka-streamed telecom events, turning the score into a live risk signal.
- Fairness auditing across region, gender and age bands before any real lending
  decision rides on the model — a synthetic population cannot surface the
  disparate impact a real one would.

---

*IndiaScored — Akshat Sarkar*
