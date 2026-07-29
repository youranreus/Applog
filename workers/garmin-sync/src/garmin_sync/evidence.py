"""Resolve private Garmin coordinates into route, point, or none evidence."""

import math
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

from .spatial import valid_points

EvidenceKind = Literal["route", "point", "none"]
EvidenceProvenance = Literal["activity", "weather"]


@dataclass(frozen=True, slots=True)
class LocationEvidence:
    """Ephemeral private geometry used only while rendering one cover."""

    kind: EvidenceKind
    points: tuple[tuple[float, float], ...]
    provenance: EvidenceProvenance | None


def _finite_coordinate(value: object, minimum: float, maximum: float) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) and minimum <= number <= maximum else None


def _point_from_mapping(
    value: object, pairs: tuple[tuple[str, str], ...]
) -> tuple[float, float] | None:
    if not isinstance(value, Mapping):
        return None
    for latitude_key, longitude_key in pairs:
        latitude = _finite_coordinate(value.get(latitude_key), -90, 90)
        longitude = _finite_coordinate(value.get(longitude_key), -180, 180)
        if latitude is not None and longitude is not None:
            return latitude, longitude
    return None


def extract_activity_point(raw: object) -> tuple[float, float] | None:
    """Read only explicit activity/start coordinate pairs from a private list item."""
    pairs = (
        ("startLatitude", "startLongitude"),
        ("startLat", "startLon"),
        ("latitude", "longitude"),
        ("lat", "lon"),
    )
    direct = _point_from_mapping(raw, pairs)
    if direct is not None:
        return direct
    if isinstance(raw, Mapping):
        for key in ("startLocation", "startPoint", "location"):
            nested = _point_from_mapping(raw.get(key), pairs)
            if nested is not None:
                return nested
    return None


def extract_weather_point(payload: object) -> tuple[float, float] | None:
    """Read an explicit Garmin weather location without treating it as a track."""
    pairs = (("latitude", "longitude"), ("lat", "lon"))
    direct = _point_from_mapping(payload, pairs)
    if direct is not None:
        return direct
    if isinstance(payload, Mapping):
        for key in ("weather", "location", "observationLocation"):
            nested = _point_from_mapping(payload.get(key), pairs)
            if nested is not None:
                return nested
    return None


def resolve_location_evidence(
    route_points: list[tuple[float, float]],
    *,
    activity_point: tuple[float, float] | None = None,
    weather_payload: Any = None,
) -> LocationEvidence:
    """Apply route → activity point → weather point priority deterministically."""
    route = valid_points(route_points)
    distinct_route = list(dict.fromkeys(route))
    if len(distinct_route) >= 2:
        return LocationEvidence("route", tuple(route), "activity")
    if distinct_route:
        return LocationEvidence("point", (distinct_route[0],), "activity")
    if activity_point is not None and valid_points([activity_point]):
        return LocationEvidence("point", (activity_point,), "activity")
    weather_point = extract_weather_point(weather_payload)
    if weather_point is not None:
        return LocationEvidence("point", (weather_point,), "weather")
    return LocationEvidence("none", (), None)
