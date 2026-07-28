"""Orchestrate one bounded, idempotent Garmin synchronization."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Protocol

from .models import ActivitySnapshot, SyncResult
from .normalize import normalize_activity
from .route import build_route_preview

ROUTE_BATCH_SIZE = 12
ROUTE_ACTIVITY_TYPES = {
    "running",
    "track_running",
    "trail_running",
    "ultra_run",
    "virtual_run",
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
        snapshots = [
            snapshot
            for raw in raw_activities
            if (snapshot := normalize_activity(raw)) is not None
        ]
        snapshots.sort(key=lambda item: item.started_at, reverse=True)
        processed_routes = self._repository.processed_route_ids()
        route_count = 0
        route_attempt_count = 0
        for snapshot in snapshots:
            if snapshot.source_activity_id in processed_routes:
                continue
            if snapshot.activity_type not in ROUTE_ACTIVITY_TYPES:
                snapshot.route_processed = True
                continue
            if route_attempt_count >= ROUTE_BATCH_SIZE:
                break
            route_attempt_count += 1
            route = build_route_preview(
                self._adapter.get_route_points(snapshot.source_activity_id)
            )
            if route:
                snapshot.route_path_data = route.path_data
                snapshot.route_view_box = route.view_box
                route_count += 1
            snapshot.route_processed = True
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
