"""Orchestrate one bounded, idempotent Garmin synchronization."""

import hashlib
import logging
import os
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Protocol
from zoneinfo import ZoneInfo

from .cover import (
    active_render_version,
    configured_route_provider,
    render_activity_cover,
)
from .evidence import extract_activity_point, resolve_location_evidence
from .models import ActivitySnapshot, NormalizedActivityDetail, SyncResult
from .normalize import (
    normalize_activity,
    normalize_activity_detail,
    normalize_health_daily,
    normalize_private_activity,
)
from .repository import ArchivedPayloadUnreadable
from .route import build_route_preview

ROUTE_BATCH_SIZE = 12
PRIVATE_DETAIL_BATCH_SIZE = 2
ACTIVITY_BACKFILL_PAGE_SIZE = 20
HEALTH_EMPTY_DAY_LIMIT = 30
ROUTE_ACTIVITY_TYPES = {
    "running",
    "track_running",
    "trail_running",
    "ultra_run",
    "virtual_run",
    "soccer",
    "cycling",
    "mountain_biking",
    "gravel_cycling",
    "walking",
    "hiking",
}
LOGGER = logging.getLogger(__name__)
LANDING_HEALTH_FIELDS = {
    "steps",
    "stepGoal",
    "restingHeartRateBpm",
    "moderateIntensityMinutes",
    "vigorousIntensityMinutes",
    "averageStressLevel",
    "bodyBattery",
    "sleepScore",
    "sleepSeconds",
}


class ReadAdapter(Protocol):
    def count_activities(self) -> int: ...
    def get_activities_by_date(self, start: str, end: str) -> list[object]: ...
    def get_route_points(self, activity_id: str) -> list[tuple[float, float]]: ...
    def dump_tokens(self) -> str: ...


class SnapshotRepository(Protocol):
    def processed_route_ids(self) -> set[str]: ...
    def commit_success(
        self,
        *,
        snapshots: list[ActivitySnapshot],
        total_count: int,
        cutoff: datetime,
        synced_at: datetime,
        token_json: str,
        backfill_cursor: str | None,
        backfill_complete: bool,
    ) -> None: ...


class SyncService:
    """Normalize a complete 12-month listing and atomically publish snapshots."""

    def __init__(
        self,
        adapter: ReadAdapter,
        repository: SnapshotRepository,
        *,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._adapter = adapter
        self._repository = repository
        self._now = now

    def run(self) -> SyncResult:
        """Execute a read-only upstream sync and commit one consistent snapshot."""
        synced_at = self._now()
        cutoff = synced_at - timedelta(days=365)
        total_count = max(0, self._adapter.count_activities())
        raw_activities = self._adapter.get_activities_by_date(
            cutoff.date().isoformat(), synced_at.date().isoformat()
        )
        snapshots: list[ActivitySnapshot] = []
        activity_points_by_id: dict[str, tuple[float, float]] = {}
        for raw in raw_activities:
            snapshot = normalize_activity(raw)
            if snapshot is None:
                continue
            snapshots.append(snapshot)
            point = extract_activity_point(raw)
            if point is not None:
                activity_points_by_id[snapshot.source_activity_id] = point
        snapshots.sort(key=lambda item: item.started_at, reverse=True)
        detail_by_source_id = self._archive_private_activity_slice(
            raw_activities, synced_at
        )
        for snapshot in snapshots:
            detail = detail_by_source_id.get(snapshot.source_activity_id)
            if detail is not None:
                snapshot.detail_data = self._public_detail(snapshot, detail)
        self._archive_health_days(synced_at)
        processed_routes = self._repository.processed_route_ids()
        covered_activity_ids = (
            self._repository.covered_activity_ids(
                active_render_version(), configured_route_provider()
            )
            if hasattr(self._repository, "covered_activity_ids")
            else set()
        )
        route_count = 0
        route_attempt_count = 0
        route_points_by_id: dict[str, list[tuple[float, float]]] = {}
        route_attempted_ids: set[str] = set()
        for snapshot in snapshots:
            if (
                snapshot.source_activity_id in processed_routes
                and snapshot.source_activity_id in covered_activity_ids
            ):
                continue
            if snapshot.activity_type not in ROUTE_ACTIVITY_TYPES:
                snapshot.route_processed = True
                continue
            if route_attempt_count >= ROUTE_BATCH_SIZE:
                break
            route_attempt_count += 1
            route_attempted_ids.add(snapshot.source_activity_id)
            points = self._adapter.get_route_points(snapshot.source_activity_id)
            route_points_by_id[snapshot.source_activity_id] = points
            route = build_route_preview(points)
            if route:
                snapshot.route_path_data = route.path_data
                snapshot.route_view_box = route.view_box
                route_count += 1
            snapshot.route_processed = True
        self._generate_candidate_covers(
            [
                snapshot
                for snapshot in snapshots[:6]
                if snapshot.source_activity_id not in covered_activity_ids
            ],
            route_points_by_id,
            route_attempted_ids,
            activity_points_by_id,
            synced_at,
        )
        unresolved = next(
            (
                snapshot.source_activity_id
                for snapshot in snapshots
                if snapshot.source_activity_id not in processed_routes
                and not snapshot.route_processed
            ),
            None,
        )
        self._repository.commit_success(
            snapshots=snapshots,
            total_count=total_count,
            cutoff=cutoff,
            synced_at=synced_at,
            token_json=self._adapter.dump_tokens(),
            backfill_cursor=unresolved,
            backfill_complete=unresolved is None,
        )
        return SyncResult(total_count, len(snapshots), route_count)

    def _generate_candidate_covers(
        self,
        candidates: list[ActivitySnapshot],
        route_points_by_id: dict[str, list[tuple[float, float]]],
        route_attempted_ids: set[str],
        activity_points_by_id: dict[str, tuple[float, float]],
        synced_at: datetime,
    ) -> None:
        """Generate covers only for the public newest-six projection."""
        if os.getenv("GARMIN_MAP_COVERS_ENABLED", "true").casefold() != "true":
            return
        if not hasattr(self._repository, "store_activity_cover"):
            return
        for snapshot in candidates:
            try:
                if (
                    snapshot.activity_type in ROUTE_ACTIVITY_TYPES
                    and snapshot.source_activity_id not in route_attempted_ids
                ):
                    continue
                points = route_points_by_id.get(snapshot.source_activity_id, [])
                weather_payload = None
                if (
                    not points
                    and snapshot.source_activity_id not in activity_points_by_id
                    and hasattr(self._repository, "get_activity_weather_payload")
                ):
                    weather_payload = self._repository.get_activity_weather_payload(
                        snapshot.source_activity_id
                    )
                evidence = resolve_location_evidence(
                    points,
                    activity_point=activity_points_by_id.get(
                        snapshot.source_activity_id
                    ),
                    weather_payload=weather_payload,
                )
                cover = render_activity_cover(snapshot.activity_type, evidence)
                snapshot.cover_id = self._repository.store_activity_cover(
                    snapshot.source_activity_id, cover, generated_at=synced_at
                )
                activity_hash = hashlib.sha256(
                    snapshot.source_activity_id.encode()
                ).hexdigest()[:12]
                LOGGER.info(
                    "Garmin cover outcome=%s category=%s provider=%s activity=%s",
                    cover.outcome,
                    cover.failure_category or "none",
                    cover.provider,
                    activity_hash,
                )
            except Exception as error:
                activity_hash = hashlib.sha256(
                    snapshot.source_activity_id.encode()
                ).hexdigest()[:12]
                LOGGER.warning(
                    "Garmin cover outcome=unexpected_error error_type=%s activity=%s",
                    type(error).__name__,
                    activity_hash,
                )
                continue

    def _archive_private_activity_slice(
        self, raw_recent: list[object], synced_at: datetime
    ) -> dict[str, NormalizedActivityDetail]:
        """Archive recent data first, then advance one bounded history page."""
        if os.getenv("GARMIN_PRIVATE_ARCHIVE_ENABLED", "true").casefold() != "true":
            return {}
        required = (
            "upsert_private_activity",
            "store_private_payload",
            "get_stream_cursor",
            "advance_stream",
            "activity_needs_detail",
            "mark_activity_detail_pending",
            "pending_activity_details",
        )
        if not all(hasattr(self._repository, name) for name in required):
            return {}
        if not hasattr(self._adapter, "get_activity_payloads"):
            return {}

        repository = self._repository
        raw_candidates = list(raw_recent)
        cursor_value, complete = repository.get_stream_cursor("activity-list")
        page_start = int(cursor_value or "0")
        page_size = 0
        if not complete and hasattr(self._adapter, "get_activities_page"):
            page = self._adapter.get_activities_page(
                page_start, ACTIVITY_BACKFILL_PAGE_SIZE
            )
            raw_candidates.extend(page)
            page_size = len(page)

        seen: set[str] = set()
        detail_by_source_id: dict[str, NormalizedActivityDetail] = {}
        for raw in raw_candidates:
            private = normalize_private_activity(raw)
            if private is None or private.source_activity_id in seen:
                continue
            seen.add(private.source_activity_id)
            private_id = repository.upsert_private_activity(private, seen_at=synced_at)
            list_changed = repository.store_private_payload(
                domain="activity",
                owner_key=str(private_id),
                payload_kind="list",
                value=raw,
                fetched_at=synced_at,
            )
            if list_changed:
                repository.mark_activity_detail_pending(private_id)

        for private_id, source_activity_id in repository.pending_activity_details(
            PRIVATE_DETAIL_BATCH_SIZE
        ):
            payloads: dict[str, object] = {}
            previous_status = "pending"
            if hasattr(repository, "load_archived_activity_detail_payloads"):
                try:
                    payloads, previous_status = (
                        repository.load_archived_activity_detail_payloads(private_id)
                    )
                except ArchivedPayloadUnreadable:
                    payloads = {}
            if "summary" in payloads:
                detail = normalize_activity_detail(
                    payloads.get("summary"),
                    payloads.get("splits"),
                    payloads.get("typed_splits"),
                    payloads.get("split_summaries"),
                )
                restored_status = (
                    previous_status if previous_status != "pending" else "complete"
                )
                repository.upsert_activity_detail(
                    private_id,
                    detail,
                    status=restored_status,
                )
                detail_by_source_id[source_activity_id] = detail
                continue
            payloads = self._adapter.get_activity_payloads(source_activity_id)
            archived_kinds: set[str] = set()
            for kind, payload in payloads.items():
                try:
                    repository.store_private_payload(
                        domain="activity",
                        owner_key=str(private_id),
                        payload_kind=kind,
                        value=payload,
                        fetched_at=synced_at,
                        binary=kind == "fit",
                    )
                    archived_kinds.add(kind)
                except ValueError as error:
                    if str(error) != "garmin_payload_too_large":
                        raise
            detail = normalize_activity_detail(
                payloads.get("summary"),
                payloads.get("splits"),
                payloads.get("typed_splits"),
                payloads.get("split_summaries"),
            )
            repository.upsert_activity_detail(
                private_id,
                detail,
                status="complete" if len(archived_kinds) == 10 else "partial",
            )
            detail_by_source_id[source_activity_id] = detail
        if not complete and hasattr(self._adapter, "get_activities_page"):
            next_start = page_start + page_size
            repository.advance_stream(
                "activity-list",
                str(next_start)
                if page_size == ACTIVITY_BACKFILL_PAGE_SIZE
                else None,
                complete=page_size < ACTIVITY_BACKFILL_PAGE_SIZE,
                succeeded_at=synced_at,
            )
        return detail_by_source_id

    def _archive_health_days(self, synced_at: datetime) -> None:
        """Refresh today and yesterday independently in Garmin's natural date."""
        if os.getenv("GARMIN_HEALTH_BACKFILL_ENABLED", "true").casefold() != "true":
            return
        required = (
            "store_private_payload",
            "upsert_health_day",
            "get_stream_cursor",
            "advance_stream",
        )
        if not all(hasattr(self._repository, name) for name in required):
            return
        if not hasattr(self._adapter, "get_health_payloads"):
            return
        health_time_zone = ZoneInfo(os.getenv("GARMIN_TIME_ZONE", "Asia/Shanghai"))
        local_today = synced_at.astimezone(health_time_zone).date()
        for offset in (0, 1):
            self._archive_health_day(
                (local_today - timedelta(days=offset)).isoformat(),
                synced_at,
            )

        cursor_value, complete = self._repository.get_stream_cursor("health:daily")
        if complete:
            return
        cursor_date, separator, streak_value = (cursor_value or "").partition("|")
        backfill_date = (
            datetime.fromisoformat(cursor_date).date()
            if cursor_date
            else local_today - timedelta(days=2)
        )
        empty_streak = int(streak_value) if separator and streak_value.isdigit() else 0
        succeeded, has_data = self._archive_health_day(
            backfill_date.isoformat(), synced_at
        )
        if not succeeded:
            return
        next_date = backfill_date - timedelta(days=1)
        empty_streak = 0 if has_data else empty_streak + 1
        empty_limit = max(
            1,
            int(
                os.getenv(
                    "GARMIN_HEALTH_EMPTY_DAY_LIMIT", str(HEALTH_EMPTY_DAY_LIMIT)
                )
            ),
        )
        reached_boundary = empty_streak >= empty_limit
        self._repository.advance_stream(
            "health:daily",
            None if reached_boundary else f"{next_date.isoformat()}|{empty_streak}",
            complete=reached_boundary,
            succeeded_at=synced_at,
        )

    def _archive_health_day(
        self, calendar_date: str, fetched_at: datetime
    ) -> tuple[bool, bool]:
        payloads, failed_domains = self._adapter.get_health_payloads(calendar_date)
        status: dict[str, str] = {}
        for domain, payload in payloads.items():
            self._repository.store_private_payload(
                domain="health",
                owner_key=calendar_date,
                payload_kind=domain,
                value=payload,
                fetched_at=fetched_at,
            )
            status[domain] = (
                "available" if self._has_health_measurement(payload) else "no_data"
            )
        status.update({domain: "failed" for domain in failed_domains})
        health = normalize_health_daily(payloads)
        self._repository.upsert_health_day(calendar_date, health, status)
        present_fields = sorted(
            field
            for field in LANDING_HEALTH_FIELDS
            if health.summary_data.get(field) is not None
        )
        missing_fields = sorted(LANDING_HEALTH_FIELDS.difference(present_fields))
        LOGGER.info(
            "Garmin health fields_present=%s fields_missing=%s "
            "domains_available=%d domains_failed=%d",
            ",".join(present_fields) or "none",
            ",".join(missing_fields) or "none",
            sum(value == "available" for value in status.values()),
            len(failed_domains),
        )
        has_data = any(
            value is not None for value in health.summary_data.values()
        ) or self._has_health_measurement(payloads)
        return not failed_domains, has_data

    @staticmethod
    def _has_health_measurement(value: object) -> bool:
        """Treat observed numeric zero and non-empty sequences as real data."""
        if isinstance(value, bool) or value is None:
            return False
        if isinstance(value, int | float):
            return True
        if isinstance(value, list):
            return bool(value) and any(
                SyncService._has_health_measurement(item) for item in value
            )
        if isinstance(value, dict):
            return any(
                SyncService._has_health_measurement(item)
                for key, item in value.items()
                if not any(
                    marker in str(key).casefold()
                    for marker in ("timestamp", "calendar", "date", "profilepk")
                )
            )
        return False

    @staticmethod
    def _public_detail(
        snapshot: ActivitySnapshot, detail: NormalizedActivityDetail
    ) -> dict[str, object]:
        average_pace = None
        if (
            detail.average_speed_meters_per_second is not None
            and detail.average_speed_meters_per_second > 0
        ):
            average_pace = 1000 / detail.average_speed_meters_per_second
        return {
            "type": snapshot.activity_type,
            "typeDisplay": snapshot.activity_type_display,
            "date": snapshot.started_at.isoformat(),
            "distanceMeters": snapshot.distance_meters,
            "durationSeconds": snapshot.duration_seconds,
            "movingDurationSeconds": detail.moving_duration_seconds,
            "calories": snapshot.calories,
            "averagePaceSecondsPerKm": average_pace,
            "averageSpeedMetersPerSecond": detail.average_speed_meters_per_second,
            "maxSpeedMetersPerSecond": detail.max_speed_meters_per_second,
            "averageHeartRateBpm": detail.average_heart_rate_bpm,
            "maxHeartRateBpm": detail.max_heart_rate_bpm,
            "elevationGainMeters": detail.elevation_gain_meters,
            "averageCadencePerMinute": detail.average_cadence_per_minute,
            "averagePowerWatts": detail.average_power_watts,
            "trainingEffect": detail.training_effect,
            "anaerobicTrainingEffect": detail.anaerobic_training_effect,
            "activityTrainingLoad": detail.activity_training_load,
            "bodyBatteryDelta": detail.body_battery_delta,
            "steps": detail.steps,
            "lapCount": detail.lap_count,
            "splits": detail.splits or [],
        }
