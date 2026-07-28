"""Worker-owned normalized models."""

from dataclasses import dataclass
from datetime import datetime


@dataclass(slots=True)
class ActivitySnapshot:
    """Allowlisted activity data safe to persist after route normalization."""

    source_activity_id: str
    activity_type: str
    activity_type_display: str
    started_at: datetime
    distance_meters: float | None
    duration_seconds: int
    calories: int | None
    location_name: str | None
    device_source: str | None
    source_updated_at: datetime | None
    route_path_data: str | None = None
    route_view_box: str | None = None
    route_processed: bool = False


@dataclass(frozen=True, slots=True)
class SyncResult:
    """Non-sensitive invocation summary."""

    total_count: int
    published_count: int
    route_count: int
