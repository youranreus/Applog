"""Alibaba Function Compute timer entry point."""

import json
import logging
import os
import time
from datetime import UTC, datetime
from typing import Any

from .adapter import GarminReadAdapter, GarminRequestBudgetExhausted
from .credential import decode_key
from .repository import MySQLRepository
from .sync import SyncService

LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.INFO)


def _category(error: Exception) -> str:
    from garminconnect import (
        GarminConnectAuthenticationError,
        GarminConnectTooManyRequestsError,
    )

    if isinstance(error, GarminConnectAuthenticationError):
        return "authentication"
    if isinstance(error, GarminConnectTooManyRequestsError):
        return "rate_limit"
    if isinstance(error, GarminRequestBudgetExhausted):
        return "request_budget"
    if isinstance(error, KeyError | ValueError):
        return "configuration"
    if str(error) == "garmin_credential_missing":
        return "credential_missing"
    return "upstream_or_storage"


def handler(event: Any, context: Any) -> str:
    """Run one leased synchronization without logging request or activity data."""
    del event
    started_at = time.monotonic()
    request_id = str(getattr(context, "request_id", "unknown"))[:128]
    attempted_at = datetime.now(UTC)
    private_enabled = any(
        os.getenv(name, "true").casefold() == "true"
        for name in (
            "GARMIN_PRIVATE_ARCHIVE_ENABLED",
            "GARMIN_HEALTH_BACKFILL_ENABLED",
        )
    )
    data_key = (
        decode_key(os.environ["GARMIN_DATA_ENCRYPTION_KEY"])
        if private_enabled
        else None
    )
    repository = MySQLRepository.from_environment(
        decode_key(os.environ["GARMIN_TOKEN_ENCRYPTION_KEY"]),
        data_key,
    )
    if not repository.acquire_lease():
        repository.close()
        LOGGER.info(
            "Garmin sync skipped reason=lease_busy elapsed_ms=%d request_id=%s",
            int((time.monotonic() - started_at) * 1000),
            request_id,
        )
        return json.dumps({"status": "skipped", "reason": "lease_busy"})
    try:
        repository.begin_attempt(attempted_at)
        adapter = GarminReadAdapter(
            repository.load_token(),
            is_cn=os.getenv("GARMIN_IS_CN", "true").casefold() == "true",
        )
        result = SyncService(adapter, repository).run()
        LOGGER.info(
            "Garmin sync healthy total=%d published=%d routes=%d "
            "elapsed_ms=%d request_id=%s",
            result.total_count,
            result.published_count,
            result.route_count,
            int((time.monotonic() - started_at) * 1000),
            request_id,
        )
        return json.dumps(
            {
                "status": "healthy",
                "total": result.total_count,
                "published": result.published_count,
                "routes": result.route_count,
            }
        )
    except Exception as error:
        category = _category(error)
        repository.mark_failure(attempted_at, category)
        LOGGER.warning(
            "Garmin sync failed category=%s elapsed_ms=%d request_id=%s",
            category,
            int((time.monotonic() - started_at) * 1000),
            request_id,
        )
        raise
    finally:
        repository.release_lease()
        repository.close()
