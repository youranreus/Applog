"""Static WebP activity covers with private, camera-aligned overlays."""

import hashlib
import io
import math
from dataclasses import dataclass
from typing import Any

from .evidence import LocationEvidence
from .map_renderer import (
    PROTOMAPS_ATTRIBUTION,
    BasemapRenderError,
    LocalMapRenderer,
    active_render_version,
    configured_renderer,
    configured_route_provider,
)
from .spatial import MapCamera, fit_camera, valid_points

COVER_WIDTH = 480
COVER_HEIGHT = 480
RENDER_SCALE = 2
DEFAULT_ROUTE_PADDING_PIXELS = 32
MAX_ROUTE_PADDING_PIXELS = 200
RENDER_VERSION = "garmin-cover-v4"
SOCCER_ACTIVITY_TYPE = "soccer"

NO_MAP_PROVIDER = "no-map"
FALLBACK_NO_MAP_PROVIDER = "fallback-no-map"
LOCAL_POINT_PROVIDER = "local-point"
LOCAL_ROUTE_PROVIDER = "local-route"
PROTOMAPS_POINT_PROVIDER = "protomaps-point"
PROTOMAPS_ROUTE_PROVIDER = "protomaps-route"
PROTOMAPS_HEATMAP_PROVIDER = "protomaps-heatmap"
CURRENT_MAP_PROVIDERS = {
    PROTOMAPS_POINT_PROVIDER,
    PROTOMAPS_ROUTE_PROVIDER,
    PROTOMAPS_HEATMAP_PROVIDER,
    NO_MAP_PROVIDER,
}


@dataclass(frozen=True, slots=True)
class ActivityCover:
    image_data: bytes
    width: int
    height: int
    etag: str
    provider: str
    attribution: str | None
    render_version: str = RENDER_VERSION
    outcome: str = "map_success"
    failure_category: str | None = None
    provenance: str | None = None


def _encode_webp(
    image: Any,
    *,
    provider: str,
    attribution: str | None,
    outcome: str,
    failure_category: str | None = None,
    provenance: str | None = None,
) -> ActivityCover:
    output = io.BytesIO()
    image.save(output, "WEBP", quality=84, method=6, exif=b"")
    data = output.getvalue()
    return ActivityCover(
        data,
        COVER_WIDTH,
        COVER_HEIGHT,
        hashlib.sha256(data).hexdigest(),
        provider,
        attribution,
        active_render_version(),
        outcome,
        failure_category,
        provenance,
    )


def _blank_canvas() -> Any:
    from PIL import Image, ImageDraw

    size = COVER_WIDTH * RENDER_SCALE
    image = Image.new("RGBA", (size, size), "#e8eceb")
    draw = ImageDraw.Draw(image)
    grid = 64
    for position in range(-size, size * 2, grid):
        draw.line((position, 0, position - size, size), fill="#d9dfdd", width=2)
    return image


def _finalize(
    image: Any,
    *,
    provider: str,
    attribution: str | None,
    outcome: str,
    failure_category: str | None = None,
    provenance: str | None = None,
) -> ActivityCover:
    from PIL import Image

    final = image.convert("RGB").resize(
        (COVER_WIDTH, COVER_HEIGHT), Image.Resampling.LANCZOS
    )
    return _encode_webp(
        final,
        provider=provider,
        attribution=attribution,
        outcome=outcome,
        failure_category=failure_category,
        provenance=provenance,
    )


def render_no_map_cover(
    *, failure_category: str | None = None
) -> ActivityCover:
    """Render an explicit coordinate-free cover without implying a location."""
    from PIL import ImageDraw

    image = _blank_canvas()
    draw = ImageDraw.Draw(image)
    center = COVER_WIDTH
    stroke = "#65706d"
    fill = "#f5f7f6"
    draw.rounded_rectangle(
        (center - 170, center - 130, center + 170, center + 130),
        radius=28,
        fill=fill,
        outline=stroke,
        width=8,
    )
    draw.line(
        (center - 56, center - 126, center - 56, center + 126),
        fill=stroke,
        width=6,
    )
    draw.line(
        (center + 56, center - 126, center + 56, center + 126),
        fill=stroke,
        width=6,
    )
    draw.line(
        (center - 190, center - 190, center + 190, center + 190),
        fill="#9a5a55",
        width=18,
    )
    provider = FALLBACK_NO_MAP_PROVIDER if failure_category else NO_MAP_PROVIDER
    return _finalize(
        image,
        provider=provider,
        attribution=None,
        outcome="fallback_created" if failure_category else "no_coordinates",
        failure_category=failure_category,
    )


def render_pin_cover() -> ActivityCover:
    """Backward-compatible name for the explicit coordinate-free cover."""
    return render_no_map_cover()


def _draw_marker(image: Any, point: tuple[float, float]) -> None:
    from PIL import ImageDraw

    draw = ImageDraw.Draw(image)
    x, y = point
    radius = 17
    draw.ellipse(
        (x - radius, y - radius, x + radius, y + radius),
        fill="#ffffff",
        outline="#263936",
        width=7,
    )
    draw.ellipse((x - 6, y - 6, x + 6, y + 6), fill="#d95f54")


def _project_scaled(
    camera: MapCamera, point: tuple[float, float]
) -> tuple[float, float]:
    x, y = camera.project(point)
    return x * RENDER_SCALE, y * RENDER_SCALE


def _renderer_or_error(renderer: LocalMapRenderer | None) -> LocalMapRenderer:
    if renderer is not None:
        return renderer
    configured = configured_renderer()
    if configured is None:
        raise BasemapRenderError("renderer_unhealthy")
    return configured


def render_point_cover(
    point: tuple[float, float],
    *,
    provenance: str,
    renderer: LocalMapRenderer | None = None,
) -> ActivityCover:
    """Render a mapped activity/weather point, with a typed local fallback."""
    valid = valid_points([point])
    if not valid:
        return render_no_map_cover()
    camera = fit_camera(valid, padding=DEFAULT_ROUTE_PADDING_PIXELS)
    try:
        basemap = _renderer_or_error(renderer).render(camera, valid)
        _draw_marker(basemap, _project_scaled(camera, valid[0]))
        return _finalize(
            basemap,
            provider=PROTOMAPS_POINT_PROVIDER,
            attribution=PROTOMAPS_ATTRIBUTION,
            outcome="map_success",
            provenance=provenance,
        )
    except BasemapRenderError as error:
        image = _blank_canvas()
        _draw_marker(image, _project_scaled(camera, valid[0]))
        return _finalize(
            image,
            provider=LOCAL_POINT_PROVIDER,
            attribution=None,
            outcome="fallback_created",
            failure_category=error.category,
            provenance=provenance,
        )


def _draw_route(
    image: Any, camera: MapCamera, points: list[tuple[float, float]]
) -> None:
    from PIL import ImageDraw

    coordinates = [_project_scaled(camera, point) for point in points]
    draw = ImageDraw.Draw(image)
    draw.line(
        coordinates,
        fill="#203f3a",
        width=8,
        joint="curve",
    )
    endpoint_radius = 8
    for point, fill in ((coordinates[0], "#ffffff"), (coordinates[-1], "#d95f54")):
        draw.ellipse(
            (
                point[0] - endpoint_radius,
                point[1] - endpoint_radius,
                point[0] + endpoint_radius,
                point[1] + endpoint_radius,
            ),
            fill=fill,
            outline="#203f3a",
            width=3,
        )


def render_route_cover(
    points: list[tuple[float, float]],
    *,
    renderer: LocalMapRenderer | None = None,
) -> ActivityCover:
    """Render a route after fitting the final camera; never crop an overlay."""
    route = valid_points(points)
    if len(set(route)) < 2:
        if route:
            return render_point_cover(
                route[0], provenance="activity", renderer=renderer
            )
        return render_no_map_cover()
    camera = fit_camera(
        route,
        padding=DEFAULT_ROUTE_PADDING_PIXELS,
        overlay_radius=4,
    )
    try:
        basemap = _renderer_or_error(renderer).render(camera, route)
        _draw_route(basemap, camera, route)
        return _finalize(
            basemap,
            provider=PROTOMAPS_ROUTE_PROVIDER,
            attribution=PROTOMAPS_ATTRIBUTION,
            outcome="map_success",
        )
    except BasemapRenderError as error:
        image = _blank_canvas()
        _draw_route(image, camera, route)
        return _finalize(
            image,
            provider=LOCAL_ROUTE_PROVIDER,
            attribution=None,
            outcome="fallback_created",
            failure_category=error.category,
        )


def _heat_palette() -> list[int]:
    stops = (
        (0.0, (36, 137, 133)),
        (0.42, (61, 190, 139)),
        (0.72, (241, 197, 66)),
        (1.0, (224, 81, 67)),
    )
    palette: list[int] = []
    for value in range(256):
        ratio = value / 255
        for index in range(len(stops) - 1):
            start_ratio, start_color = stops[index]
            end_ratio, end_color = stops[index + 1]
            if ratio > end_ratio:
                continue
            progress = (ratio - start_ratio) / (end_ratio - start_ratio)
            palette.extend(
                round(start + (end - start) * progress)
                for start, end in zip(start_color, end_color, strict=True)
            )
            break
    return palette


def _draw_heatmap(
    image: Any, camera: MapCamera, points: list[tuple[float, float]]
) -> Any:
    from PIL import Image

    grid_size = 120
    render_size = COVER_WIDTH * RENDER_SCALE
    counts: dict[tuple[int, int], int] = {}
    for point in points:
        x, y = _project_scaled(camera, point)
        cell = (
            max(0, min(grid_size - 1, round(x / render_size * grid_size))),
            max(0, min(grid_size - 1, round(y / render_size * grid_size))),
        )
        counts[cell] = counts.get(cell, 0) + 1
    field = [0.0] * (grid_size * grid_size)
    spread = 10
    sigma_squared = 12.25
    for (x, y), count in counts.items():
        weight = math.log1p(count)
        for grid_y in range(max(0, y - spread), min(grid_size, y + spread + 1)):
            for grid_x in range(
                max(0, x - spread), min(grid_size, x + spread + 1)
            ):
                distance_squared = (grid_x - x) ** 2 + (grid_y - y) ** 2
                field[grid_y * grid_size + grid_x] += weight * math.exp(
                    -distance_squared / (2 * sigma_squared)
                )
    maximum = max(field)
    density = Image.new("L", (grid_size, grid_size))
    density.putdata([round(255 * value / maximum) for value in field])
    density = density.resize((render_size, render_size), Image.Resampling.BICUBIC)
    heat = density.convert("P")
    heat.putpalette(_heat_palette())
    heat = heat.convert("RGBA")
    heat.putalpha(density.point(lambda value: 0 if value < 3 else min(190, value)))
    return Image.alpha_composite(image.convert("RGBA"), heat)


def render_soccer_heatmap_cover(
    points: list[tuple[float, float]],
    *,
    renderer: LocalMapRenderer | None = None,
) -> ActivityCover:
    """Render real GPS density over a camera-aligned Protomaps basemap."""
    samples = valid_points(points)
    if len(set(samples)) < 2:
        if samples:
            return render_point_cover(
                samples[0], provenance="activity", renderer=renderer
            )
        return render_no_map_cover()
    camera = fit_camera(
        samples,
        padding=DEFAULT_ROUTE_PADDING_PIXELS,
        overlay_radius=20,
    )
    try:
        basemap = _renderer_or_error(renderer).render(camera, samples)
        image = _draw_heatmap(basemap, camera, samples)
        return _finalize(
            image,
            provider=PROTOMAPS_HEATMAP_PROVIDER,
            attribution=PROTOMAPS_ATTRIBUTION,
            outcome="map_success",
        )
    except BasemapRenderError as error:
        return render_no_map_cover(failure_category=error.category)


def render_activity_cover(
    activity_type: str,
    evidence: LocationEvidence,
    *,
    renderer: LocalMapRenderer | None = None,
) -> ActivityCover:
    """Select the cover variant without exposing evidence outside the worker."""
    if evidence.kind == "none":
        return render_no_map_cover()
    if evidence.kind == "point":
        return render_point_cover(
            evidence.points[0],
            provenance=evidence.provenance or "activity",
            renderer=renderer,
        )
    points = list(evidence.points)
    if activity_type == SOCCER_ACTIVITY_TYPE:
        return render_soccer_heatmap_cover(points, renderer=renderer)
    return render_route_cover(points, renderer=renderer)


def cover_provider_rank(provider: str, activity_type: str) -> int:
    """Keep cover upgrades monotonic and reject stale soccer heatmaps."""
    if provider == PROTOMAPS_HEATMAP_PROVIDER:
        return 5 if activity_type == SOCCER_ACTIVITY_TYPE else -1
    if provider == "local-heatmap":
        return 4 if activity_type == SOCCER_ACTIVITY_TYPE else -1
    if provider.startswith("carto"):
        return 4
    if provider == PROTOMAPS_ROUTE_PROVIDER:
        return 4
    if provider == LOCAL_ROUTE_PROVIDER:
        return 3
    if provider == PROTOMAPS_POINT_PROVIDER:
        return 2
    if provider == LOCAL_POINT_PROVIDER:
        return 1
    return 0


__all__ = [
    "ActivityCover",
    "CURRENT_MAP_PROVIDERS",
    "DEFAULT_ROUTE_PADDING_PIXELS",
    "NO_MAP_PROVIDER",
    "PROTOMAPS_HEATMAP_PROVIDER",
    "PROTOMAPS_POINT_PROVIDER",
    "PROTOMAPS_ROUTE_PROVIDER",
    "RENDER_VERSION",
    "SOCCER_ACTIVITY_TYPE",
    "active_render_version",
    "configured_route_provider",
    "cover_provider_rank",
    "render_activity_cover",
    "render_no_map_cover",
    "render_pin_cover",
    "render_point_cover",
    "render_route_cover",
    "render_soccer_heatmap_cover",
]
