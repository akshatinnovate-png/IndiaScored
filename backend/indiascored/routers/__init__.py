"""HTTP routers, one per bounded area of the product."""

from . import applications, notifications, profiles, psychometric, scoring, system, underwriting

ALL_ROUTERS = (
    system.router,
    profiles.router,
    psychometric.router,
    applications.router,
    scoring.router,
    notifications.router,
    underwriting.router,
)

__all__ = ["ALL_ROUTERS"]
