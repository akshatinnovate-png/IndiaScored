"""Repository for applicant profiles, applications and notifications.

One collection holds two kinds of document, distinguished by ``doc_type``:

``profile``      one per applicant — identity, demographics, latest assessment
``application``  one per loan request — alternative data, score card, review

Applications are addressed by ``(clerk_user_id, submitted_at)`` where
``submitted_at`` is a canonical ISO-8601 string. Storing it as a string
rather than a BSON date means the value in a URL is byte-identical to the
value in the database, which removes a whole class of lookup failures.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable, Mapping, Optional

from pymongo import DESCENDING
from pymongo.collection import Collection

from ..core.database import applicants_collection

PROFILE = "profile"
APPLICATION = "application"

OPEN_STATUSES = ("submitted", "pending")
CLOSED_APPROVED = ("approved",)
CLOSED_ADVERSE = ("rejected", "flagged")


def utc_now_iso() -> str:
    """Canonical timestamp format used as an application's identity."""
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="milliseconds")


class ApplicantRepository:
    """Every read and write IndiaScored performs against MongoDB."""

    def __init__(self, collection: Optional[Collection] = None) -> None:
        self._collection = collection if collection is not None else applicants_collection()

    # --- profiles ------------------------------------------------------

    def upsert_profile(self, clerk_user_id: str, profile: Mapping[str, Any]) -> None:
        self._collection.update_one(
            {"doc_type": PROFILE, "clerk_user_id": clerk_user_id},
            {
                "$set": {
                    "profile": dict(profile),
                    "profile_updated_at": utc_now_iso(),
                },
                "$setOnInsert": {
                    "doc_type": PROFILE,
                    "clerk_user_id": clerk_user_id,
                    "created_at": utc_now_iso(),
                },
            },
            upsert=True,
        )

    def get_profile(self, clerk_user_id: str) -> Optional[dict]:
        doc = self._collection.find_one(
            {"doc_type": PROFILE, "clerk_user_id": clerk_user_id}, {"_id": 0}
        )
        return doc.get("profile") if doc else None

    def applicant_name(self, clerk_user_id: str) -> str:
        profile = self.get_profile(clerk_user_id) or {}
        return profile.get("name") or "the applicant"

    # --- psychometric --------------------------------------------------

    def save_psychometric(self, clerk_user_id: str, score: float) -> dict:
        taken_at = utc_now_iso()
        self._collection.update_one(
            {"doc_type": PROFILE, "clerk_user_id": clerk_user_id},
            {
                "$set": {"psychometric": {"score": score, "taken_at": taken_at}},
                "$setOnInsert": {
                    "doc_type": PROFILE,
                    "clerk_user_id": clerk_user_id,
                    "created_at": taken_at,
                },
            },
            upsert=True,
        )
        return {"score": score, "taken_at": taken_at}

    def get_psychometric(self, clerk_user_id: str) -> Optional[dict]:
        doc = self._collection.find_one(
            {"doc_type": PROFILE, "clerk_user_id": clerk_user_id}, {"_id": 0, "psychometric": 1}
        )
        return (doc or {}).get("psychometric")

    # --- applications --------------------------------------------------

    def create_application(
        self, clerk_user_id: str, alternative_data: Mapping[str, Any], consent: bool
    ) -> str:
        submitted_at = utc_now_iso()
        self._collection.insert_one(
            {
                "doc_type": APPLICATION,
                "clerk_user_id": clerk_user_id,
                "submitted_at": submitted_at,
                "alternative_data": dict(alternative_data),
                "consent": consent,
                "status": "submitted",
                "score_card": None,
                "narration": None,
            }
        )
        return submitted_at

    def list_applications(self, clerk_user_id: str, limit: int = 50) -> list[dict]:
        cursor = (
            self._collection.find(
                {"doc_type": APPLICATION, "clerk_user_id": clerk_user_id}, {"_id": 0}
            )
            .sort("submitted_at", DESCENDING)
            .limit(limit)
        )
        return list(cursor)

    def get_application(self, clerk_user_id: str, submitted_at: str) -> Optional[dict]:
        return self._collection.find_one(
            {
                "doc_type": APPLICATION,
                "clerk_user_id": clerk_user_id,
                "submitted_at": submitted_at,
            },
            {"_id": 0},
        )

    def attach_score_card(
        self, clerk_user_id: str, submitted_at: str, score_card: Mapping[str, Any]
    ) -> None:
        self._collection.update_one(
            {"doc_type": APPLICATION, "clerk_user_id": clerk_user_id, "submitted_at": submitted_at},
            {"$set": {"score_card": dict(score_card), "scored_at": utc_now_iso(), "status": "pending"}},
        )

    def attach_narration(
        self, clerk_user_id: str, submitted_at: str, narration: Mapping[str, Any]
    ) -> None:
        self._collection.update_one(
            {"doc_type": APPLICATION, "clerk_user_id": clerk_user_id, "submitted_at": submitted_at},
            {"$set": {"narration": dict(narration), "narrated_at": utc_now_iso()}},
        )

    def record_review(
        self,
        clerk_user_id: str,
        submitted_at: str,
        status: str,
        remarks: str,
        internal_notes: str,
        reviewer: str,
        notification_message: str,
    ) -> bool:
        result = self._collection.update_one(
            {"doc_type": APPLICATION, "clerk_user_id": clerk_user_id, "submitted_at": submitted_at},
            {
                "$set": {
                    "status": status,
                    "review": {
                        "remarks": remarks,
                        "internal_notes": internal_notes,
                        "reviewer": reviewer,
                        "decided_at": utc_now_iso(),
                    },
                    "notification": {
                        "message": notification_message,
                        "issued_at": utc_now_iso(),
                        "read": False,
                    },
                }
            },
        )
        return result.matched_count > 0

    # --- notifications -------------------------------------------------

    def list_notifications(self, clerk_user_id: str) -> list[dict]:
        cursor = self._collection.find(
            {
                "doc_type": APPLICATION,
                "clerk_user_id": clerk_user_id,
                "notification": {"$exists": True, "$ne": None},
            },
            {
                "_id": 0,
                "submitted_at": 1,
                "status": 1,
                "notification": 1,
                "review.remarks": 1,
                "alternative_data.loan_amount_requested": 1,
                "alternative_data.loan_category": 1,
                "score_card.india_score": 1,
                "score_card.grade": 1,
            },
        ).sort("notification.issued_at", DESCENDING)

        notifications = []
        for doc in cursor:
            notice = doc["notification"]
            notifications.append(
                {
                    "id": f"{clerk_user_id}::{doc['submitted_at']}",
                    "message": notice.get("message", ""),
                    "issued_at": notice.get("issued_at"),
                    "read": notice.get("read", False),
                    "status": doc.get("status"),
                    "submitted_at": doc.get("submitted_at"),
                    "remarks": (doc.get("review") or {}).get("remarks", ""),
                    "loan_amount": (doc.get("alternative_data") or {}).get("loan_amount_requested", 0),
                    "loan_category": (doc.get("alternative_data") or {}).get("loan_category", ""),
                    "india_score": (doc.get("score_card") or {}).get("india_score"),
                    "grade": (doc.get("score_card") or {}).get("grade"),
                }
            )
        return notifications

    def unread_count(self, clerk_user_id: str) -> int:
        return self._collection.count_documents(
            {"doc_type": APPLICATION, "clerk_user_id": clerk_user_id, "notification.read": False}
        )

    def mark_notifications_read(self, clerk_user_id: str, submitted_at: Optional[str] = None) -> int:
        query: dict[str, Any] = {
            "doc_type": APPLICATION,
            "clerk_user_id": clerk_user_id,
            "notification.read": False,
        }
        if submitted_at:
            query["submitted_at"] = submitted_at
        return self._collection.update_many(query, {"$set": {"notification.read": True}}).modified_count

    # --- underwriting queue --------------------------------------------

    def pipeline_summary(self) -> dict:
        """Status counts, computed by MongoDB rather than in Python."""
        buckets = list(
            self._collection.aggregate(
                [
                    {"$match": {"doc_type": APPLICATION}},
                    {"$group": {"_id": "$status", "count": {"$sum": 1}}},
                ]
            )
        )
        summary = {"total": 0, "open": 0, "approved": 0, "adverse": 0, "by_status": {}}
        for bucket in buckets:
            status = bucket["_id"] or "submitted"
            count = bucket["count"]
            summary["total"] += count
            summary["by_status"][status] = count
            if status in OPEN_STATUSES:
                summary["open"] += count
            elif status in CLOSED_APPROVED:
                summary["approved"] += count
            elif status in CLOSED_ADVERSE:
                summary["adverse"] += count
        return summary

    def grade_distribution(self) -> dict[str, int]:
        """How the scored book is spread across risk grades."""
        buckets = self._collection.aggregate(
            [
                {"$match": {"doc_type": APPLICATION, "score_card.grade": {"$ne": None}}},
                {"$group": {"_id": "$score_card.grade", "count": {"$sum": 1}}},
            ]
        )
        return {bucket["_id"]: bucket["count"] for bucket in buckets}

    def review_queue(self, limit: int = 100) -> list[dict]:
        """Applications joined to their profile, newest first."""
        cursor = self._collection.aggregate(
            [
                {"$match": {"doc_type": APPLICATION}},
                {"$sort": {"submitted_at": DESCENDING}},
                {"$limit": limit},
                {
                    "$lookup": {
                        "from": self._collection.name,
                        "let": {"uid": "$clerk_user_id"},
                        "pipeline": [
                            {
                                "$match": {
                                    "$expr": {
                                        "$and": [
                                            {"$eq": ["$doc_type", PROFILE]},
                                            {"$eq": ["$clerk_user_id", "$$uid"]},
                                        ]
                                    }
                                }
                            },
                            {"$project": {"_id": 0, "profile": 1}},
                        ],
                        "as": "profile_doc",
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "clerk_user_id": 1,
                        "submitted_at": 1,
                        "status": 1,
                        "loan_amount_requested": "$alternative_data.loan_amount_requested",
                        "loan_category": "$alternative_data.loan_category",
                        "india_score": "$score_card.india_score",
                        "grade": "$score_card.grade",
                        "decision": "$score_card.decision",
                        "name": {"$arrayElemAt": ["$profile_doc.profile.name", 0]},
                    }
                },
            ]
        )
        return list(cursor)

    def distinct_applicants(self) -> Iterable[str]:
        return self._collection.distinct("clerk_user_id", {"doc_type": APPLICATION})
