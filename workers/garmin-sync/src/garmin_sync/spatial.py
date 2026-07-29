"""One Web Mercator camera shared by basemaps and private overlays."""

import math
from collections.abc import Iterable
from dataclasses import dataclass

TILE_SIZE = 512.0
MAX_MERCATOR_LATITUDE = 85.05112878
DEFAULT_POINT_ZOOM = 15.0
MAX_ROUTE_ZOOM = 24.0


def valid_points(
    points: Iterable[tuple[float, float]],
) -> list[tuple[float, float]]:
    """Validate coordinates and remove consecutive duplicates."""
    result: list[tuple[float, float]] = []
    for latitude, longitude in points:
        if not (math.isfinite(latitude) and math.isfinite(longitude)):
            continue
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            continue
        point = (float(latitude), float(longitude))
        if not result or point != result[-1]:
            result.append(point)
    return result


def _world_point(latitude: float, longitude: float) -> tuple[float, float]:
    latitude = max(-MAX_MERCATOR_LATITUDE, min(MAX_MERCATOR_LATITUDE, latitude))
    x = (longitude + 180.0) / 360.0
    radians = math.radians(latitude)
    y = (1.0 - math.asinh(math.tan(radians)) / math.pi) / 2.0
    return x, y


def _longitude(world_x: float) -> float:
    return (world_x % 1.0) * 360.0 - 180.0


def _latitude(world_y: float) -> float:
    value = math.atan(math.sinh(math.pi * (1.0 - 2.0 * world_y)))
    return math.degrees(value)


def _unwrap_xs(points: list[tuple[float, float]]) -> list[float]:
    raw = [_world_point(latitude, longitude)[0] for latitude, longitude in points]
    if not raw:
        return []
    unwrapped = [raw[0]]
    previous_raw = raw[0]
    for value in raw[1:]:
        delta = value - previous_raw
        if delta > 0.5:
            delta -= 1.0
        elif delta < -0.5:
            delta += 1.0
        unwrapped.append(unwrapped[-1] + delta)
        previous_raw = value
    return unwrapped


@dataclass(frozen=True, slots=True)
class MapCamera:
    """MapLibre-compatible logical camera with deterministic projection."""

    center_latitude: float
    center_longitude: float
    zoom: float
    width: int = 480
    height: int = 480

    def project(self, point: tuple[float, float]) -> tuple[float, float]:
        """Project a WGS84 point into logical cover pixels."""
        world_x, world_y = _world_point(*point)
        center_x, center_y = _world_point(
            self.center_latitude, self.center_longitude
        )
        delta_x = (world_x - center_x + 0.5) % 1.0 - 0.5
        world_size = TILE_SIZE * 2**self.zoom
        return (
            self.width / 2.0 + delta_x * world_size,
            self.height / 2.0 + (world_y - center_y) * world_size,
        )


def fit_camera(
    raw_points: Iterable[tuple[float, float]],
    *,
    width: int = 480,
    height: int = 480,
    padding: int = 32,
    overlay_radius: float = 4.0,
    point_zoom: float = DEFAULT_POINT_ZOOM,
    max_zoom: float = MAX_ROUTE_ZOOM,
) -> MapCamera:
    """Fit valid points without relying on renderer-specific auto-fit rules."""
    points = valid_points(raw_points)
    if not points:
        raise ValueError("invalid_geometry")
    if len(set(points)) == 1:
        latitude, longitude = points[0]
        return MapCamera(latitude, longitude, min(point_zoom, max_zoom), width, height)

    xs = _unwrap_xs(points)
    ys = [_world_point(latitude, longitude)[1] for latitude, longitude in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    available_width = width - 2.0 * (padding + overlay_radius)
    available_height = height - 2.0 * (padding + overlay_radius)
    if available_width <= 0 or available_height <= 0:
        raise ValueError("invalid_viewport_padding")
    span_x = max_x - min_x
    span_y = max_y - min_y
    zoom_x = (
        math.inf
        if span_x == 0
        else math.log2(available_width / (span_x * TILE_SIZE))
    )
    zoom_y = (
        math.inf
        if span_y == 0
        else math.log2(available_height / (span_y * TILE_SIZE))
    )
    zoom = min(zoom_x, zoom_y, max_zoom)
    if not math.isfinite(zoom):
        zoom = min(point_zoom, max_zoom)
    center_x = (min_x + max_x) / 2.0
    center_y = (min_y + max_y) / 2.0
    return MapCamera(
        _latitude(center_y),
        _longitude(center_x),
        zoom,
        width,
        height,
    )
