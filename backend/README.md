# IndiaScored — Backend

FastAPI service that scores thin-file applicants on alternative data and
explains every decision. Built by Akshat Sarkar.

## Layout

```
indiascored/
  main.py              application factory, CORS, lifespan
  core/                settings, MongoDB client, process singletons
  schemas/             pydantic request/response contracts
  scoring/
    grading.py         pure credit policy — PD to grade, score, sanction
    features.py        feature engineering shared with the training notebook
    bundle.py          model bundle loading and the calibrated pipeline
    engine.py          record in, explained ScoreCard out
  explain/
    knowledge.py       retrieval: feature name to domain note
    narrator.py        generation: notes to an underwriter's remark
  repositories/        the only code that touches MongoDB
  routers/             one router per product area
artifacts/             serialized model bundle
tests/                 unit tests for the credit policy and the API
```

## Running

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                 # then set MONGO_URI
uvicorn indiascored.main:app --reload --port 8000
```

Swagger is at http://localhost:8000/docs. `GET /health` reports whether the
model, the SHAP explainer and the local LLM are each available.

Optional, for LLM-written remarks instead of the rule-based fallback:

```bash
ollama pull mistral
```

## Tests

```bash
pytest
```
