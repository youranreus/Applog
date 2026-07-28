"""Fail-closed normalization for unstable Garmin payloads."""

import math
import re
from datetime import datetime
from typing import Any
from xml.etree import ElementTree

from .models import ActivitySnapshot

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
