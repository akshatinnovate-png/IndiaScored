"""IndiaScored API — application factory and lifespan wiring.

Author: Akshat Sarkar
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .core.database import ensure_indexes
from .core.state import get_bundle, get_knowledge_base
from .routers import ALL_ROUTERS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
)
logger = logging.getLogger("indiascored")

DESCRIPTION = """
Credit risk scoring for applicants with no formal credit history.

IndiaScored reads alternative data — telecom behaviour, utility punctuality,
cooperative standing, land verification and a timed psychometric assessment —
and returns a calibrated probability of default, a 300-900 IndiaScore, a risk
grade, a sanctionable amount, and a SHAP-backed explanation written in plain
English for the loan officer who has to defend the decision.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the model once, warm the knowledge base, ensure indexes."""
    settings = get_settings()
    bundle = get_bundle()
    get_knowledge_base()
    ensure_indexes()

    if bundle.is_ready:
        logger.info("%s v%s ready (model: %s)", settings.app_name, settings.app_version, bundle.source)
    else:
        logger.warning("Starting in DEGRADED mode — no scoring model: %s", bundle.error)

    yield
    logger.info("IndiaScored API shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=DESCRIPTION,
        contact={"name": settings.author},
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    for router in ALL_ROUTERS:
        app.include_router(router)

    return app


app = create_app()
