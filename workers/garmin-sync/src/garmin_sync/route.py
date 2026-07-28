"""Convert ephemeral GPS points into coordinate-free SVG route geometry."""

import math
import re
from collections.abc import Iterable
from dataclasses import dataclass

EARTH_RADIUS_METERS = 6_371_000.0
VIEWBOX_SIZE = 100.0
VIEWBOX_PADDING = 4.0
PATH_PATTERN = re.compile(
    r"^M \d+(?:\.\d+)? \d+(?:\.\d+)?(?: L \d+(?:\.\d+)? \d+(?:\.\d+)?)+$"
)


@dataclass(frozen=True, slots=True)
class RoutePreview:
    """Safe geometry persisted for public SVG rendering."""

    path_data: str
    view_box: str = "0 0 100 100"


def _valid_points(points: Iterable[tuple[float, float]]) -> list[tuple[float, float]]:
    valid: list[tuple[float, float]] = []
    for latitude, longitude in points:
        if not (math.isfinite(latitude) and math.isfinite(longitude)):
            continue
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            continue
        point = (float(latitude), float(longitude))
        if not valid or point != valid[-1]:
            valid.append(point)
    return valid


def _project(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    mean_latitude = math.radians(sum(point[0] for point in points) / len(points))
    return [
        (
            EARTH_RADIUS_METERS * math.radians(longitude) * math.cos(mean_latitude),
            EARTH_RADIUS_METERS * math.radians(latitude),
        )
        for latitude, longitude in points
    ]


def _distance_to_segment(
    point: tuple[float, float],
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    if dx == 0 and dy == 0:
        return math.hypot(point[0] - start[0], point[1] - start[1])
    ratio = max(
        0.0,
        min(
            1.0,
            ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy)
            / (dx * dx + dy * dy),
        ),
    )
    nearest = (start[0] + ratio * dx, start[1] + ratio * dy)
    return math.hypot(point[0] - nearest[0], point[1] - nearest[1])


def _rdp(
    points: list[tuple[float, float]], tolerance: float
) -> list[tuple[float, float]]:
    if len(points) <= 2:
        return points
    kept = {0, len(points) - 1}
    pending = [(0, len(points) - 1)]
    while pending:
        start_index, end_index = pending.pop()
        start, end = points[start_index], points[end_index]
        candidates = (
            (_distance_to_segment(points[index], start, end), index)
            for index in range(start_index + 1, end_index)
        )
        distance, index = max(candidates, default=(0.0, start_index))
        if distance <= tolerance:
            continue
        kept.add(index)
        pending.append((start_index, index))
        pending.append((index, end_index))
    return [points[index] for index in sorted(kept)]


def _cap_points(
    points: list[tuple[float, float]], max_points: int
) -> list[tuple[float, float]]:
    if len(points) <= max_points:
        return points
    last = len(points) - 1
    indexes = [round(index * last / (max_points - 1)) for index in range(max_points)]
    return [points[index] for index in indexes]


def _format_coordinate(value: float) -> str:
    text = f"{value:.3f}".rstrip("0").rstrip(".")
    return "0" if text == "-0" else text


def _normalize(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    width = max(xs) - min(xs)
    height = max(ys) - min(ys)
    drawable = VIEWBOX_SIZE - 2 * VIEWBOX_PADDING
    scale = drawable / max(width, height)
    content_width = width * scale
    content_height = height * scale
    offset_x = (VIEWBOX_SIZE - content_width) / 2
    offset_y = (VIEWBOX_SIZE - content_height) / 2
    return [
        (
            offset_x + (x - min(xs)) * scale,
            VIEWBOX_SIZE - (offset_y + (y - min(ys)) * scale),
        )
        for x, y in points
    ]


def build_route_preview(
    raw_points: Iterable[tuple[float, float]], *, max_points: int = 320
) -> RoutePreview | None:
    """Build a bounded SVG path while preserving the full track's endpoints."""
    if max_points < 2:
        raise ValueError("max_points must be at least 2")
    points = _valid_points(raw_points)
    if len(points) < 2 or len(set(points)) < 2:
        return None
    projected = _project(points)
    xs = [point[0] for point in projected]
    ys = [point[1] for point in projected]
    diagonal = math.hypot(max(xs) - min(xs), max(ys) - min(ys))
    simplified = _rdp(projected, max(diagonal / 1500, 0.25))
    simplified = _cap_points(simplified, max_points)
    normalized = _normalize(simplified)
    commands = [
        f"{'M' if index == 0 else 'L'} {_format_coordinate(x)} {_format_coordinate(y)}"
        for index, (x, y) in enumerate(normalized)
    ]
    path_data = " ".join(commands)
    if len(path_data) > 32_000 or not PATH_PATTERN.fullmatch(path_data):
        return None
    return RoutePreview(path_data=path_data)
