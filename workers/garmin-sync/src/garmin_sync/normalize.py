"""Fail-closed normalization for unstable Garmin payloads."""

import math
import re
from datetime import UTC, datetime
from typing import Any
from xml.etree import ElementTree

from .models import (
    ActivitySnapshot,
    NormalizedActivityDetail,
    NormalizedHealthDaily,
    PrivateActivity,
)

TYPE_LABELS = {
    "running": "跑步",
    "trail_running": "越野跑",
    "treadmill_running": "跑步机",
    "track_running": "操场跑步",
    "virtual_run": "虚拟跑",
    "ultra_run": "超马",
    "cycling": "骑行",
    "indoor_cycling": "室内骑行",
    "mountain_biking": "山地骑行",
    "gravel_cycling": "砾石骑行",
    "walking": "步行",
    "hiking": "徒步",
    "swimming": "游泳",
    "open_water_swimming": "公开水域游泳",
    "lap_swimming": "泳池游泳",
    "elliptical": "椭圆机",
    "soccer": "足球",
    "strength_training": "力量训练",
    "cardio": "有氧训练",
    "indoor_cardio": "有氧运动",
    "stair_climbing": "爬山机",
    "yoga": "瑜伽",
}

_LOCATION_MAX_LENGTH = 64
_COORDINATE_PAIR = re.compile(
    r"(?:^|[\s,;/|])"
    r"-?\d{1,3}(?:\.\d+)?\s*[,;/\s]\s*-?\d{1,3}(?:\.\d+)?"
    r"(?:$|[\s,;/|])"
)
_COORDINATE_KEYWORD = re.compile(
    r"(?:lat|lon|latitude|longitude)\s*[:=]?\s*-?\d",
    re.IGNORECASE,
)


def _parse_datetime(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _finite_number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def _public(activity: dict[str, Any]) -> bool:
    privacy = activity.get("privacy")
    return (
        isinstance(privacy, dict)
        and isinstance(privacy.get("typeKey"), str)
        and privacy["typeKey"].casefold() in {"public", "everyone"}
    )


def _normalize_calories(value: object) -> int | None:
    """Round finite non-negative calories; reject invalid values as null."""
    number = _finite_number(value)
    if number is None or number < 0:
        return None
    return round(number)


def _normalize_location_name(activity: dict[str, Any]) -> str | None:
    """Keep a short display location string; reject coordinate-like values."""
    raw: object = None
    for key in ("locationName", "location"):
        candidate = activity.get(key)
        if isinstance(candidate, str) and candidate.strip():
            raw = candidate
            break
    if not isinstance(raw, str):
        return None
    cleaned = " ".join(raw.split())
    if not cleaned:
        return None
    wrapped = f" {cleaned} "
    if _COORDINATE_PAIR.search(wrapped) or _COORDINATE_KEYWORD.search(cleaned):
        return None
    return cleaned[:_LOCATION_MAX_LENGTH]


def normalize_activity(activity: object) -> ActivitySnapshot | None:
    """Return an allowlisted public snapshot, or ``None`` on ambiguity."""
    if not isinstance(activity, dict) or not _public(activity):
        return None
    source_id = activity.get("activityId")
    activity_type = activity.get("activityType")
    type_key = activity_type.get("typeKey") if isinstance(activity_type, dict) else None
    started_at = _parse_datetime(
        activity.get("startTimeGMT") or activity.get("startTimeLocal")
    )
    duration = _finite_number(activity.get("duration"))
    if source_id is None or not isinstance(type_key, str) or not type_key.strip():
        return None
    if started_at is None or duration is None or duration < 0:
        return None
    distance = _finite_number(activity.get("distance"))
    if distance is not None and distance < 0:
        distance = None
    normalized_type = type_key.strip().casefold()
    device = next(
        (
            value.strip()
            for key in ("deviceModel", "deviceName", "manufacturer")
            if isinstance((value := activity.get(key)), str) and value.strip()
        ),
        None,
    )
    return ActivitySnapshot(
        source_activity_id=str(source_id),
        activity_type=normalized_type,
        activity_type_display=TYPE_LABELS.get(
            normalized_type, normalized_type.replace("_", " ")
        ),
        started_at=started_at,
        distance_meters=distance,
        duration_seconds=round(duration),
        calories=_normalize_calories(activity.get("calories")),
        location_name=_normalize_location_name(activity),
        device_source=device,
        source_updated_at=_parse_datetime(activity.get("lastUpdatedDate")),
    )


def normalize_private_activity(activity: object) -> PrivateActivity | None:
    """Index any valid activity without applying public visibility rules."""
    if not isinstance(activity, dict):
        return None
    source_id = activity.get("activityId")
    activity_type = activity.get("activityType")
    type_key = activity_type.get("typeKey") if isinstance(activity_type, dict) else None
    if source_id is None or not isinstance(type_key, str) or not type_key.strip():
        return None
    privacy = activity.get("privacy")
    privacy_type = privacy.get("typeKey") if isinstance(privacy, dict) else None
    activity_uuid = activity.get("activityUUID") or activity.get("activityUuid")
    return PrivateActivity(
        source_activity_id=str(source_id),
        activity_uuid=str(activity_uuid) if activity_uuid is not None else None,
        activity_type=type_key.strip().casefold(),
        privacy_type=privacy_type.casefold() if isinstance(privacy_type, str) else None,
        started_at_gmt=_parse_datetime(activity.get("startTimeGMT")),
        started_at_local=_parse_datetime(activity.get("startTimeLocal")),
        source_updated_at=_parse_datetime(activity.get("lastUpdatedDate")),
    )


def _metric(source: dict[str, Any], *keys: str) -> float | None:
    return next(
        (
            value
            for key in keys
            if (value := _finite_number(source.get(key))) is not None
        ),
        None,
    )


def normalize_activity_detail(
    summary: object, splits: object = None
) -> NormalizedActivityDetail:
    """Extract stable nullable metrics from synthetic-compatible source shapes."""
    source = summary if isinstance(summary, dict) else {}
    split_rows: list[object] = []
    if isinstance(splits, list):
        split_rows = splits
    elif isinstance(splits, dict):
        for key in ("lapDTOs", "splitDTOs", "splits"):
            candidate = splits.get(key)
            if isinstance(candidate, list):
                split_rows = candidate
                break
    compact_splits: list[dict[str, Any]] = []
    for index, row in enumerate(split_rows[:12], start=1):
        if not isinstance(row, dict):
            continue
        distance = _metric(row, "distance", "distanceMeters")
        duration = _metric(row, "duration", "durationSeconds")
        speed = _metric(row, "averageSpeed", "avgSpeed")
        compact_splits.append(
            {
                "index": index,
                "type": row.get("type") if isinstance(row.get("type"), str) else None,
                "distanceMeters": distance,
                "durationSeconds": duration,
                "averagePaceSecondsPerKm": (
                    1000 / speed if speed is not None and speed > 0 else None
                ),
                "averageHeartRateBpm": _metric(
                    row, "averageHR", "averageHeartRate", "avgHr"
                ),
            }
        )
    lap_count = _metric(source, "lapCount", "numberOfLaps")
    return NormalizedActivityDetail(
        moving_duration_seconds=_metric(source, "movingDuration"),
        average_speed_meters_per_second=_metric(source, "averageSpeed"),
        max_speed_meters_per_second=_metric(source, "maxSpeed"),
        average_heart_rate_bpm=_metric(source, "averageHR", "averageHeartRate"),
        max_heart_rate_bpm=_metric(source, "maxHR", "maxHeartRate"),
        elevation_gain_meters=_metric(source, "elevationGain", "totalAscent"),
        average_cadence_per_minute=_metric(
            source, "averageRunningCadenceInStepsPerMinute", "averageBikingCadence"
        ),
        average_power_watts=_metric(source, "avgPower", "averagePower"),
        training_effect=_metric(source, "aerobicTrainingEffect", "trainingEffect"),
        body_battery_delta=_metric(source, "differenceBodyBattery"),
        lap_count=(
            round(lap_count) if lap_count is not None and lap_count >= 0 else None
        ),
        splits=compact_splits,
    )


_HEALTH_METRICS: dict[str, tuple[str, tuple[str, ...]]] = {
    "bodyBatteryCharged": (
        "body_battery",
        ("bodyBatteryChargedValue", "chargedValue", "charged"),
    ),
    "bodyBatteryDrained": (
        "body_battery",
        ("bodyBatteryDrainedValue", "drainedValue", "drained"),
    ),
    "averageStressLevel": (
        "stress",
        ("avgStressLevel", "averageStressLevel"),
    ),
    "maxStressLevel": ("stress", ("maxStressLevel",)),
    "averageHeartRateBpm": (
        "heart_rate",
        ("averageHeartRate", "avgHeartRate"),
    ),
    "maxHeartRateBpm": ("heart_rate", ("maxHeartRate",)),
    "restingHeartRateBpm": (
        "resting_heart_rate",
        ("restingHeartRate", "restingHeartRateValue"),
    ),
    "steps": ("steps", ("totalSteps",)),
    "stepGoal": ("steps", ("dailyStepGoal", "stepGoal")),
    "sleepSeconds": (
        "sleep",
        ("sleepTimeSeconds", "sleepTimeInSeconds", "totalSleepSeconds"),
    ),
    "sleepScore": ("sleep", ("overallSleepScore",)),
    "hrvLastNightAverageMs": ("hrv", ("lastNightAvg", "lastNightAverage")),
    "hrvWeeklyAverageMs": ("hrv", ("weeklyAvg", "weeklyAverage")),
    "averageSpO2Percent": ("spo2", ("averageSpO2", "avgSpO2")),
    "lowestSpO2Percent": ("spo2", ("lowestSpO2", "minSpO2")),
    "averageWakingRespirationPerMinute": (
        "respiration",
        ("avgWakingRespirationValue", "averageWakingRespirationValue"),
    ),
    "averageSleepRespirationPerMinute": (
        "respiration",
        ("avgSleepRespirationValue", "averageSleepRespirationValue"),
    ),
    "hydrationConsumedMl": (
        "hydration",
        ("valueInML", "consumedInML", "hydrationConsumedInML"),
    ),
    "hydrationGoalMl": ("hydration", ("goalInML", "hydrationGoalInML")),
    "moderateIntensityMinutes": (
        "intensity_minutes",
        ("moderateIntensityMinutes",),
    ),
    "vigorousIntensityMinutes": (
        "intensity_minutes",
        ("vigorousIntensityMinutes",),
    ),
    "weightGrams": ("body_composition", ("weightInGrams",)),
    "bodyFatPercent": ("body_composition", ("bodyFat", "bodyFatPercentage")),
    "bmi": ("body_composition", ("bmi",)),
}

_LOCAL_BOUNDARY_KEYS = (
    "startTimestampLocal",
    "startTimeLocal",
    "calendarStartTimeLocal",
)
_GMT_BOUNDARY_KEYS = (
    "startTimestampGMT",
    "startTimeGMT",
    "calendarStartTimeGMT",
)


def _find_field(value: object, keys: tuple[str, ...]) -> tuple[bool, object]:
    """Breadth-first exact-key lookup, preferring shallower summary objects."""
    queue = [value]
    while queue:
        current = queue.pop(0)
        if isinstance(current, dict):
            for key in keys:
                if key in current:
                    return True, current[key]
            queue.extend(current.values())
        elif isinstance(current, list):
            queue.extend(current)
    return False, None


def _parse_boundary_datetime(
    value: object, *, allow_numeric: bool
) -> datetime | None:
    if isinstance(value, int | float) and not isinstance(value, bool):
        if not allow_numeric:
            return None
        timestamp = float(value)
        if not math.isfinite(timestamp):
            return None
        if timestamp >= 1_000_000_000_000:
            timestamp /= 1000
        if not 946_684_800 <= timestamp <= 4_102_444_800:
            return None
        return datetime.fromtimestamp(timestamp, UTC)
    if not isinstance(value, str) or not re.search(r"[T ]\d{1,2}:\d{2}", value):
        return None
    return _parse_datetime(value)


def normalize_health_daily(payloads: dict[str, Any]) -> NormalizedHealthDaily:
    """Extract conservative health summaries while retaining raw payloads elsewhere."""
    summary: dict[str, float | None] = {}
    for target, (domain, aliases) in _HEALTH_METRICS.items():
        found, raw = _find_field(payloads.get(domain), aliases)
        if found:
            summary[target] = _finite_number(raw)

    local_boundary = None
    gmt_boundary = None
    for payload in payloads.values():
        if local_boundary is None:
            found, raw = _find_field(payload, _LOCAL_BOUNDARY_KEYS)
            if found:
                local_boundary = _parse_boundary_datetime(raw, allow_numeric=False)
        if gmt_boundary is None:
            found, raw = _find_field(payload, _GMT_BOUNDARY_KEYS)
            if found:
                gmt_boundary = _parse_boundary_datetime(raw, allow_numeric=True)
        if local_boundary is not None and gmt_boundary is not None:
            break
    return NormalizedHealthDaily(summary, local_boundary, gmt_boundary)


def extract_detail_points(details: object) -> list[tuple[float, float]]:
    """Extract known polyline variants without retaining the upstream object."""
    if not isinstance(details, dict):
        return []
    polyline_container = details.get("geoPolylineDTO")
    if not isinstance(polyline_container, dict):
        return []
    polyline = polyline_container.get("polyline")
    if not isinstance(polyline, list):
        return []
    points: list[tuple[float, float]] = []
    for point in polyline:
        latitude: object = None
        longitude: object = None
        if isinstance(point, dict):
            latitude = point.get("lat", point.get("latitude"))
            longitude = point.get("lon", point.get("longitude"))
        elif isinstance(point, list | tuple) and len(point) >= 2:
            latitude, longitude = point[0], point[1]
        lat = _finite_number(latitude)
        lon = _finite_number(longitude)
        if lat is not None and lon is not None:
            points.append((lat, lon))
    return points


def extract_gpx_points(content: bytes) -> list[tuple[float, float]]:
    """Parse GPX track points in memory; callers discard bytes immediately."""
    try:
        root = ElementTree.fromstring(content)
    except ElementTree.ParseError:
        return []
    points: list[tuple[float, float]] = []
    for element in root.iter():
        if not element.tag.endswith("trkpt"):
            continue
        try:
            latitude = float(element.attrib["lat"])
            longitude = float(element.attrib["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if math.isfinite(latitude) and math.isfinite(longitude):
            points.append((latitude, longitude))
    return points
