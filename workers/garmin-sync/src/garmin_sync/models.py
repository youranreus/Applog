"""Worker-owned normalized models."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any


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
    public_id: str | None = None
    detail_data: dict[str, Any] | None = None
    cover_id: str | None = None


@dataclass(slots=True)
class PrivateActivity:
    """Private activity index independent of public visibility."""

    source_activity_id: str
    activity_uuid: str | None
    activity_type: str
    privacy_type: str | None
    started_at_gmt: datetime | None
    started_at_local: datetime | None
    source_updated_at: datetime | None


@dataclass(slots=True)
class NormalizedActivityDetail:
    """Queryable metrics used to build an explicit public projection."""

    moving_duration_seconds: float | None = None
    average_speed_meters_per_second: float | None = None
    max_speed_meters_per_second: float | None = None
    average_heart_rate_bpm: float | None = None
    max_heart_rate_bpm: float | None = None
    elevation_gain_meters: float | None = None
    average_cadence_per_minute: float | None = None
    average_power_watts: float | None = None
    training_effect: float | None = None
    anaerobic_training_effect: float | None = None
    activity_training_load: float | None = None
    body_battery_delta: float | None = None
    steps: int | None = None
    lap_count: int | None = None
    splits: list[dict[str, Any]] | None = None


@dataclass(slots=True)
class NormalizedHealthDaily:
    """Queryable daily health metrics plus source-supplied day boundaries."""

    summary_data: dict[str, float | None]
    local_boundary_start: datetime | None = None
    gmt_boundary_start: datetime | None = None


@dataclass(frozen=True, slots=True)
class SyncResult:
    """Non-sensitive invocation summary."""

    total_count: int
    published_count: int
    route_count: int
