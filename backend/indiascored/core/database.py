"""MongoDB access — one client, lazily created, shared by every repository."""

from __future__ import annotations

import logging
from functools import lru_cache

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

from .config import get_settings

logger = logging.getLogger(__name__)

APPLICANTS = "applicants"


@lru_cache(maxsize=1)
def get_client() -> MongoClient:
    settings = get_settings()
    return MongoClient(settings.mongo_uri, tz_aware=False)


def get_database() -> Database:
    return get_client()[get_settings().mongo_db]


def applicants_collection() -> Collection:
    """The single collection holding profiles, applications and notices."""
    return get_database()[APPLICANTS]


def ensure_indexes() -> None:
    """Create the indexes the read paths rely on. Safe to call repeatedly."""
    try:
        collection = applicants_collection()
        collection.create_index([("clerk_user_id", ASCENDING)])
        collection.create_index([("clerk_user_id", ASCENDING), ("submitted_at", DESCENDING)])
        collection.create_index([("status", ASCENDING)])
        collection.create_index([("notification.read", ASCENDING)])
        logger.info("MongoDB indexes ensured on '%s'", APPLICANTS)
    except Exception:  # noqa: BLE001 - a DB hiccup must not block startup
        logger.exception("Could not ensure MongoDB indexes")
