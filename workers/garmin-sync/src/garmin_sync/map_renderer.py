"""Validated loopback client for a pinned Protomaps static renderer."""

import hashlib
import io
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .spatial import MapCamera

PROTOMAPS_ATTRIBUTION = "© OpenStreetMap contributors"
MAX_RASTER_BYTES = 8 * 1024 * 1024
MAX_BLANK_CHANNEL_RANGE = 8
LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost"}


class BasemapRenderError(RuntimeError):
    """Expected renderer failure with a safe, coordinate-free category."""

    def __init__(self, category: str) -> None:
        super().__init__(category)
        self.category = category


@dataclass(frozen=True, slots=True)
class CoverageRegion:
    region_id: str
    bounds: tuple[float, float, float, float]
    max_zoom: float

    def contains(self, latitude: float, longitude: float) -> bool:
        west, south, east, north = self.bounds
        longitude_matches = (
            west <= longitude <= east
            if west <= east
            else longitude >= west or longitude <= east
        )
        return south <= latitude <= north and longitude_matches


@dataclass(frozen=True, slots=True)
class MapReleaseManifest:
    release_id: str
    style_id: str
    style_version: str
    renderer_version: str
    regions: tuple[CoverageRegion, ...]

    @classmethod
    def load(cls, path: Path) -> "MapReleaseManifest":
        try:
            value = json.loads(path.read_text())
            regions = tuple(
                CoverageRegion(
                    str(item["id"]),
                    tuple(float(number) for number in item["bounds"]),
                    float(item["maxZoom"]),
                )
                for item in value["regions"]
            )
            if any(len(region.bounds) != 4 for region in regions):
                raise ValueError
            return cls(
                str(value["releaseId"]),
                str(value["styleId"]),
                str(value["styleVersion"]),
                str(value["rendererVersion"]),
                regions,
            )
        except (
            OSError,
            KeyError,
            TypeError,
            ValueError,
            json.JSONDecodeError,
        ) as error:
            raise BasemapRenderError("asset_missing") from error

    def supports(
        self, points: list[tuple[float, float]], required_zoom: float
    ) -> bool:
        return any(
            required_zoom <= region.max_zoom
            and all(
                region.contains(latitude, longitude)
                for latitude, longitude in points
            )
            for region in self.regions
        )

    def fingerprint(self) -> str:
        value = ":".join(
            (
                self.release_id,
                self.style_id,
                self.style_version,
                self.renderer_version,
            )
        )
        return hashlib.sha256(value.encode()).hexdigest()[:16]


@dataclass(frozen=True, slots=True)
class RendererConfig:
    base_url: str
    manifest: MapReleaseManifest
    connect_timeout_seconds: float = 1.0
    total_timeout_seconds: float = 8.0

    @classmethod
    def from_environment(cls) -> "RendererConfig | None":
        base_url = os.getenv("GARMIN_MAP_RENDERER_URL")
        manifest_path = os.getenv("GARMIN_MAP_RELEASE_MANIFEST")
        if not base_url and not manifest_path:
            return None
        if not base_url or not manifest_path:
            raise BasemapRenderError("asset_missing")
        parsed = urllib.parse.urlparse(base_url)
        if parsed.scheme != "http" or parsed.hostname not in LOOPBACK_HOSTS:
            raise BasemapRenderError("renderer_unhealthy")
        try:
            timeout = float(os.getenv("GARMIN_MAP_RENDER_TIMEOUT_SECONDS", "8"))
        except ValueError as error:
            raise BasemapRenderError("renderer_unhealthy") from error
        if timeout <= 0:
            raise BasemapRenderError("renderer_unhealthy")
        return cls(
            base_url.rstrip("/"),
            MapReleaseManifest.load(Path(manifest_path)),
            total_timeout_seconds=timeout,
        )


class LocalMapRenderer:
    """Request clean 2x basemaps from a loopback Martin-compatible API."""

    def __init__(self, config: RendererConfig) -> None:
        self.config = config

    def render(
        self, camera: MapCamera, points: list[tuple[float, float]]
    ) -> Any:
        if not self.config.manifest.supports(points, camera.zoom):
            raise BasemapRenderError("region_missing")
        style_id = urllib.parse.quote(self.config.manifest.style_id, safe="")
        camera_value = (
            f"{camera.center_longitude:.8f},{camera.center_latitude:.8f},"
            f"{camera.zoom:.6f}"
        )
        url = (
            f"{self.config.base_url}/style/{style_id}/static/{camera_value}/"
            f"{camera.width}x{camera.height}@2x.webp"
        )
        request = urllib.request.Request(url, headers={"Accept": "image/webp"})
        try:
            with urllib.request.urlopen(
                request, timeout=self.config.total_timeout_seconds
            ) as response:
                if getattr(response, "status", 200) != 200:
                    raise BasemapRenderError("renderer_http_error")
                content_type = response.headers.get_content_type()
                if content_type != "image/webp":
                    raise BasemapRenderError("invalid_raster")
                data = response.read(MAX_RASTER_BYTES + 1)
        except BasemapRenderError:
            raise
        except TimeoutError as error:
            raise BasemapRenderError("renderer_timeout") from error
        except urllib.error.HTTPError as error:
            category = "asset_missing" if error.code == 404 else "renderer_http_error"
            raise BasemapRenderError(category) from error
        except (urllib.error.URLError, OSError) as error:
            raise BasemapRenderError("renderer_unhealthy") from error
        if len(data) > MAX_RASTER_BYTES:
            raise BasemapRenderError("invalid_raster")
        try:
            from PIL import Image

            image = Image.open(io.BytesIO(data))
            image.load()
            if image.size != (camera.width * 2, camera.height * 2):
                raise BasemapRenderError("invalid_raster")
            rgb = image.convert("RGB")
            extrema = rgb.getextrema()
            # Lossy WebP introduces small channel noise even for a flat image.
            if all(high - low <= MAX_BLANK_CHANNEL_RANGE for low, high in extrema):
                raise BasemapRenderError("invalid_raster")
            return image.convert("RGBA")
        except BasemapRenderError:
            raise
        except Exception as error:
            raise BasemapRenderError("invalid_raster") from error


def configured_renderer() -> LocalMapRenderer | None:
    config = RendererConfig.from_environment()
    return LocalMapRenderer(config) if config is not None else None


def check_renderer_health() -> bool:
    """Probe the configured loopback service without logging its private URLs."""
    config = RendererConfig.from_environment()
    if config is None:
        return False
    request = urllib.request.Request(f"{config.base_url}/health")
    try:
        with urllib.request.urlopen(
            request, timeout=config.connect_timeout_seconds
        ) as response:
            return getattr(response, "status", 200) == 200
    except (urllib.error.URLError, OSError, TimeoutError):
        return False


def configured_route_provider() -> str | None:
    try:
        return "protomaps" if RendererConfig.from_environment() is not None else None
    except BasemapRenderError:
        return None


def active_render_version() -> str:
    """Return a bounded fingerprint covering code, data, style, and renderer."""
    try:
        config = RendererConfig.from_environment()
    except BasemapRenderError:
        return "garmin-cover-v4-unconfigured"
    if config is None:
        return "garmin-cover-v4-local"
    return f"garmin-cover-v4-{config.manifest.fingerprint()}"
