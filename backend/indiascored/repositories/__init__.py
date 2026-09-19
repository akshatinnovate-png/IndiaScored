"""Data access. Routers talk to repositories; only repositories touch Mongo."""

from .applicants import ApplicantRepository

__all__ = ["ApplicantRepository"]
