"""Static WebP activity cover rendering without embedded source metadata."""

import hashlib
import io
import os
import tempfile
from dataclasses import dataclass

from .route import build_route_preview

COVER_WIDTH = 480
COVER_HEIGHT = 480
RENDER_VERSION = "garmin-cover-v1"


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
    return _encode_webp(image, provider="local", attribution=None)


def _render_route_fallback(points: list[tuple[float, float]]) -> ActivityCover:
    from PIL import Image, ImageDraw

    preview = build_route_preview(points, max_points=320)
    if preview is None:
        return render_pin_cover()
    scale = 2
    size = COVER_WIDTH * scale
    image = Image.new("RGB", (size, size), "#15191d")
    draw = ImageDraw.Draw(image)
    coordinates = []
    for command in preview.path_data.split(" L "):
        pair = command.removeprefix("M ").split()
        coordinates.append((float(pair[0]) * 8, float(pair[1]) * 8))
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
    return _encode_webp(image, provider="local-route", attribution=None)


def render_route_cover(points: list[tuple[float, float]]) -> ActivityCover:
    """Render configured tiles at 2x, falling back to a local dark route."""
    tile_url = os.getenv("GARMIN_MAP_TILE_URL")
    attribution = os.getenv("GARMIN_MAP_ATTRIBUTION")
    provider_name = os.getenv("GARMIN_MAP_PROVIDER")
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
        context.add_object(
            staticmaps.Line(
                line, color=staticmaps.parse_color("#e8edef"), width=5
            )
        )
        image = context.render_pillow(COVER_WIDTH * 2, COVER_HEIGHT * 2)
        image = image.convert("RGB").resize(
            (COVER_WIDTH, COVER_HEIGHT), Image.Resampling.LANCZOS
        )
        return _encode_webp(
            image, provider=provider_name, attribution=attribution
        )
    except Exception:
        return _render_route_fallback(points)
