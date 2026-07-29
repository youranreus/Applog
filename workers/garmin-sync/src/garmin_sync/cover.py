"""Static WebP activity cover rendering without embedded source metadata."""

import hashlib
import io
import math
import os
import tempfile
from dataclasses import dataclass

from .route import build_route_preview

COVER_WIDTH = 480
COVER_HEIGHT = 480
DEFAULT_ROUTE_PADDING_PIXELS = 28
MAX_ROUTE_PADDING_PIXELS = 200
RENDER_VERSION = "garmin-cover-v3"
LOCAL_COVER_PROVIDER = "local"
LOCAL_ROUTE_PROVIDER = "local-route"
LOCAL_HEATMAP_PROVIDER = "local-heatmap"
SOCCER_ACTIVITY_TYPE = "soccer"


@dataclass(frozen=True, slots=True)
class ActivityCover:
    image_data: bytes
    width: int
    height: int
    etag: str
    provider: str
    attribution: str | None
    render_version: str = RENDER_VERSION


def _encode_webp(
    image: object, *, provider: str, attribution: str | None
) -> ActivityCover:
    output = io.BytesIO()
    image.save(output, "WEBP", quality=84, method=6, exif=b"")
    data = output.getvalue()
    return ActivityCover(
        image_data=data,
        width=COVER_WIDTH,
        height=COVER_HEIGHT,
        etag=hashlib.sha256(data).hexdigest(),
        provider=provider,
        attribution=attribution,
    )


def render_pin_cover() -> ActivityCover:
    """Render a quiet local cover for indoor or coordinate-free activities."""
    from PIL import Image, ImageDraw

    scale = 2
    size = COVER_WIDTH * scale
    image = Image.new("RGB", (size, size), "#15191d")
    draw = ImageDraw.Draw(image)
    center = size // 2
    draw.ellipse(
        (center - 76, center - 98, center + 76, center + 54),
        fill="#dfe5e8",
    )
    draw.polygon(
        [(center - 56, center + 8), (center + 56, center + 8), (center, center + 118)],
        fill="#dfe5e8",
    )
    draw.ellipse(
        (center - 28, center - 51, center + 28, center + 5),
        fill="#15191d",
    )
    image = image.resize((COVER_WIDTH, COVER_HEIGHT), Image.Resampling.LANCZOS)
    return _encode_webp(image, provider=LOCAL_COVER_PROVIDER, attribution=None)


def _render_route_fallback(points: list[tuple[float, float]]) -> ActivityCover:
    from PIL import Image, ImageDraw

    preview = build_route_preview(points, max_points=320)
    if preview is None:
        return render_pin_cover()
    scale = 2
    size = COVER_WIDTH * scale
    image = Image.new("RGB", (size, size), "#15191d")
    draw = ImageDraw.Draw(image)
    normalized_coordinates = []
    for command in preview.path_data.split(" L "):
        pair = command.removeprefix("M ").split()
        normalized_coordinates.append((float(pair[0]), float(pair[1])))
    xs = [point[0] for point in normalized_coordinates]
    ys = [point[1] for point in normalized_coordinates]
    width = max(xs) - min(xs)
    height = max(ys) - min(ys)
    padding = _route_padding_pixels() * scale
    drawable = size - 2 * padding
    route_scale = drawable / max(width, height)
    content_width = width * route_scale
    content_height = height * route_scale
    offset_x = (size - content_width) / 2
    offset_y = (size - content_height) / 2
    coordinates = [
        (
            offset_x + (x - min(xs)) * route_scale,
            offset_y + (y - min(ys)) * route_scale,
        )
        for x, y in normalized_coordinates
    ]
    draw.line(coordinates, fill="#e5ecef", width=7, joint="curve")
    radius = 10
    for point, color in ((coordinates[0], "#ffffff"), (coordinates[-1], "#8f9aa0")):
        draw.ellipse(
            (
                point[0] - radius,
                point[1] - radius,
                point[0] + radius,
                point[1] + radius,
            ),
            fill=color,
        )
    image = image.resize((COVER_WIDTH, COVER_HEIGHT), Image.Resampling.LANCZOS)
    return _encode_webp(image, provider=LOCAL_ROUTE_PROVIDER, attribution=None)


def _project_soccer_points(
    points: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    valid = [
        (float(latitude), float(longitude))
        for latitude, longitude in points
        if math.isfinite(latitude)
        and math.isfinite(longitude)
        and -90 <= latitude <= 90
        and -180 <= longitude <= 180
    ]
    if len(set(valid)) < 2:
        return []
    mean_latitude = math.radians(sum(point[0] for point in valid) / len(valid))
    projected = [
        (
            math.radians(longitude) * math.cos(mean_latitude),
            math.radians(latitude),
        )
        for latitude, longitude in valid
    ]
    center_x = sum(point[0] for point in projected) / len(projected)
    center_y = sum(point[1] for point in projected) / len(projected)
    centered = [(x - center_x, y - center_y) for x, y in projected]
    variance_x = sum(x * x for x, _ in centered)
    variance_y = sum(y * y for _, y in centered)
    covariance = sum(x * y for x, y in centered)
    angle = 0.5 * math.atan2(2 * covariance, variance_x - variance_y)
    cosine = math.cos(-angle)
    sine = math.sin(-angle)
    return [
        (x * cosine - y * sine, x * sine + y * cosine)
        for x, y in centered
    ]


def _heat_palette() -> list[int]:
    stops = (
        (0.0, (27, 152, 142)),
        (0.42, (46, 213, 155)),
        (0.72, (246, 211, 72)),
        (1.0, (255, 111, 54)),
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


def render_soccer_heatmap_cover(
    points: list[tuple[float, float]],
) -> ActivityCover:
    """Render a pitch heatmap derived only from real GPS sample density."""
    from PIL import Image, ImageDraw, ImageFilter, ImageOps

    projected = _project_soccer_points(points)
    if not projected:
        return render_pin_cover()

    scale = 2
    size = COVER_WIDTH * scale
    image = Image.new("RGBA", (size, size), "#111a18")
    draw = ImageDraw.Draw(image)
    pitch = (64, 168, size - 64, size - 168)
    draw.rounded_rectangle(pitch, radius=18, fill="#16362c", outline="#8eb5a5", width=3)

    xs = [point[0] for point in projected]
    ys = [point[1] for point in projected]
    width = max(xs) - min(xs)
    height = max(ys) - min(ys)
    if width <= 0 and height <= 0:
        return render_pin_cover()

    grid_width = 84
    grid_height = 60
    counts = [0] * (grid_width * grid_height)
    for x, y in projected:
        normalized_x = 0.5 if width <= 0 else (x - min(xs)) / width
        normalized_y = 0.5 if height <= 0 else (y - min(ys)) / height
        grid_x = 3 + round(normalized_x * (grid_width - 7))
        grid_y = 3 + round(normalized_y * (grid_height - 7))
        counts[grid_y * grid_width + grid_x] += 1

    maximum = max(counts)
    density = Image.new("L", (grid_width, grid_height))
    density.putdata(
        [
            round(255 * math.log1p(count) / math.log1p(maximum)) if count else 0
            for count in counts
        ]
    )
    density = density.resize(
        (pitch[2] - pitch[0], pitch[3] - pitch[1]), Image.Resampling.BICUBIC
    ).filter(ImageFilter.GaussianBlur(radius=34))
    density = ImageOps.autocontrast(density)

    heat = density.convert("P")
    heat.putpalette(_heat_palette())
    heat = heat.convert("RGBA")
    heat.putalpha(density.point(lambda value: 0 if value < 10 else min(224, value)))
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    overlay.paste(heat, (pitch[0], pitch[1]))
    image = Image.alpha_composite(image, overlay)

    draw = ImageDraw.Draw(image)
    line_color = "#b8d4c8"
    middle_x = size // 2
    middle_y = size // 2
    draw.line((middle_x, pitch[1], middle_x, pitch[3]), fill=line_color, width=3)
    draw.ellipse(
        (middle_x - 74, middle_y - 74, middle_x + 74, middle_y + 74),
        outline=line_color,
        width=3,
    )
    draw.ellipse(
        (middle_x - 5, middle_y - 5, middle_x + 5, middle_y + 5),
        fill=line_color,
    )
    penalty_depth = 112
    penalty_height = 264
    for side in (-1, 1):
        edge = pitch[0] if side < 0 else pitch[2]
        inner = edge - side * penalty_depth
        draw.rectangle(
            (
                min(edge, inner),
                middle_y - penalty_height // 2,
                max(edge, inner),
                middle_y + penalty_height // 2,
            ),
            outline=line_color,
            width=3,
        )

    image = image.convert("RGB").resize(
        (COVER_WIDTH, COVER_HEIGHT), Image.Resampling.LANCZOS
    )
    return _encode_webp(image, provider=LOCAL_HEATMAP_PROVIDER, attribution=None)


def cover_provider_rank(provider: str, activity_type: str) -> int:
    """Rank cover quality without preserving a heatmap after a type correction."""
    if provider == LOCAL_HEATMAP_PROVIDER:
        return 2 if activity_type == SOCCER_ACTIVITY_TYPE else -1
    return {
        LOCAL_COVER_PROVIDER: 0,
        LOCAL_ROUTE_PROVIDER: 1,
    }.get(provider, 2)


def _route_padding_pixels() -> int:
    value = os.getenv("GARMIN_MAP_ROUTE_PADDING_PIXELS")
    if value is None:
        return DEFAULT_ROUTE_PADDING_PIXELS
    try:
        return max(0, min(int(value), MAX_ROUTE_PADDING_PIXELS))
    except ValueError:
        return DEFAULT_ROUTE_PADDING_PIXELS


def configured_route_provider() -> str | None:
    """Return the active remote provider only when its full contract is set."""
    provider_name = os.getenv("GARMIN_MAP_PROVIDER")
    tile_url = os.getenv("GARMIN_MAP_TILE_URL")
    attribution = os.getenv("GARMIN_MAP_ATTRIBUTION")
    if provider_name and tile_url and attribution:
        return provider_name
    return None


def _crop_route_to_padding(
    image: object,
    line: list[object],
    *,
    center: object,
    zoom: int,
    tile_size: int,
) -> object:
    from staticmaps.transformer import Transformer

    render_size = COVER_WIDTH * 2
    transformer = Transformer(render_size, render_size, zoom, center, tile_size)
    pixels = [transformer.ll2pixel(point) for point in line]
    xs = [point[0] for point in pixels]
    ys = [point[1] for point in pixels]
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    visible_ratio = 1 - 2 * (_route_padding_pixels() + 2) / COVER_WIDTH
    crop_size = min(float(render_size), span / max(visible_ratio, 0.1))
    center_x = (min(xs) + max(xs)) / 2
    center_y = (min(ys) + max(ys)) / 2
    left = max(0.0, min(center_x - crop_size / 2, render_size - crop_size))
    top = max(0.0, min(center_y - crop_size / 2, render_size - crop_size))
    return image.crop((left, top, left + crop_size, top + crop_size))


def render_route_cover(points: list[tuple[float, float]]) -> ActivityCover:
    """Render configured tiles at 2x, falling back to a local dark route."""
    tile_url = os.getenv("GARMIN_MAP_TILE_URL")
    attribution = os.getenv("GARMIN_MAP_ATTRIBUTION")
    provider_name = configured_route_provider()
    if not tile_url or not attribution or not provider_name:
        return _render_route_fallback(points)
    try:
        import staticmaps
        from PIL import Image

        context = staticmaps.Context()
        provider = staticmaps.TileProvider(
            provider_name,
            tile_url,
            attribution=attribution,
        )
        context.set_tile_provider(provider)
        downloader = staticmaps.tile_downloader.TileDownloader()
        downloader.set_user_agent(
            os.getenv(
                "GARMIN_MAP_USER_AGENT",
                "AppLog-Garmin-Sync/1.0 (+https://github.com/reus/Applog)",
            )
        )
        context.set_tile_downloader(downloader)
        context.set_cache_dir(
            os.getenv(
                "GARMIN_MAP_TILE_CACHE_DIR",
                os.path.join(tempfile.gettempdir(), "applog-garmin-map-tiles"),
            )
        )
        line = [staticmaps.create_latlng(lat, lon) for lat, lon in points]
        route = staticmaps.Line(
            line, color=staticmaps.parse_color("#e8edef"), width=5
        )
        context.add_object(route)
        context.add_bounds(
            route.bounds(),
            extra_pixel_bounds=_route_padding_pixels() * 2,
        )
        render_size = COVER_WIDTH * 2
        center, zoom = context.determine_center_zoom(render_size, render_size)
        if center is None or zoom is None:
            raise RuntimeError("Cannot render route cover without center and zoom")
        image = context.render_pillow(render_size, render_size)
        image = _crop_route_to_padding(
            image,
            line,
            center=center,
            zoom=zoom,
            tile_size=provider.tile_size(),
        )
        image = image.convert("RGB").resize(
            (COVER_WIDTH, COVER_HEIGHT), Image.Resampling.LANCZOS
        )
        return _encode_webp(
            image, provider=provider_name, attribution=attribution
        )
    except Exception:
        return _render_route_fallback(points)
