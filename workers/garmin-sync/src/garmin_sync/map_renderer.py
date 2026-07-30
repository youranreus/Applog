"""Validated Tencent static-map client for private Garmin overlays."""

import hashlib
import io
import json
import logging
import math
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Protocol

from .spatial import MapCamera

LOGGER = logging.getLogger(__name__)

TENCENT_ATTRIBUTION = "© 腾讯地图"
TENCENT_STATIC_MAP_URL = "https://apis.map.qq.com/ws/staticmap/v2/"
TENCENT_RENDERER_VERSION = "static-v2-gcj02-v1"
COVER_RENDER_VERSION = "garmin-cover-v7"
MAX_RASTER_BYTES = 8 * 1024 * 1024
MAX_BLANK_CHANNEL_RANGE = 8


class BasemapRenderError(RuntimeError):
    """Expected renderer failure with a safe, coordinate-free category."""

    def __init__(self, category: str) -> None:
        super().__init__(category)
        self.category = category


@dataclass(frozen=True, slots=True)
class RenderedBasemap:
    """Raster plus the exact camera and coordinates it represents."""

    image: Any
    camera: MapCamera
    points: tuple[tuple[float, float], ...]


class BasemapRenderer(Protocol):
    def render(
        self, camera: MapCamera, points: list[tuple[float, float]]
    ) -> Any | RenderedBasemap: ...


def _outside_tencent_mainland(latitude: float, longitude: float) -> bool:
    """Apply Tencent's documented domestic static-map coordinate envelope."""
    return not (3.5 <= latitude <= 53.0 and 73.5 <= longitude <= 135.0)


def _transform_latitude(latitude: float, longitude: float) -> float:
    value = (
        -100.0
        + 2.0 * longitude
        + 3.0 * latitude
        + 0.2 * latitude * latitude
        + 0.1 * longitude * latitude
        + 0.2 * math.sqrt(abs(longitude))
    )
    value += (
        20.0 * math.sin(6.0 * longitude * math.pi)
        + 20.0 * math.sin(2.0 * longitude * math.pi)
    ) * 2.0 / 3.0
    value += (
        20.0 * math.sin(latitude * math.pi)
        + 40.0 * math.sin(latitude / 3.0 * math.pi)
    ) * 2.0 / 3.0
    return value + (
        160.0 * math.sin(latitude / 12.0 * math.pi)
        + 320.0 * math.sin(latitude * math.pi / 30.0)
    ) * 2.0 / 3.0


def _transform_longitude(latitude: float, longitude: float) -> float:
    value = (
        300.0
        + longitude
        + 2.0 * latitude
        + 0.1 * longitude * longitude
        + 0.1 * longitude * latitude
        + 0.1 * math.sqrt(abs(longitude))
    )
    value += (
        20.0 * math.sin(6.0 * longitude * math.pi)
        + 20.0 * math.sin(2.0 * longitude * math.pi)
    ) * 2.0 / 3.0
    value += (
        20.0 * math.sin(longitude * math.pi)
        + 40.0 * math.sin(longitude / 3.0 * math.pi)
    ) * 2.0 / 3.0
    return value + (
        150.0 * math.sin(longitude / 12.0 * math.pi)
        + 300.0 * math.sin(longitude / 30.0 * math.pi)
    ) * 2.0 / 3.0


def wgs84_to_gcj02(point: tuple[float, float]) -> tuple[float, float]:
    """Convert a mainland WGS-84 coordinate to Tencent's display coordinates."""
    latitude, longitude = point
    if _outside_tencent_mainland(latitude, longitude):
        raise BasemapRenderError("region_missing")
    shifted_latitude = latitude - 35.0
    shifted_longitude = longitude - 105.0
    latitude_delta = _transform_latitude(shifted_latitude, shifted_longitude)
    longitude_delta = _transform_longitude(shifted_latitude, shifted_longitude)
    radians = latitude / 180.0 * math.pi
    magic = math.sin(radians)
    magic = 1 - 0.00669342162296594323 * magic * magic
    root_magic = math.sqrt(magic)
    latitude_delta = latitude_delta * 180.0 / (
        (6335552.717000426 / (magic * root_magic)) * math.pi
    )
    longitude_delta = longitude_delta * 180.0 / (
        (6378245.0 / root_magic) * math.cos(radians) * math.pi
    )
    return latitude + latitude_delta, longitude + longitude_delta


@dataclass(frozen=True, slots=True)
class TencentRendererConfig:
    key: str
    total_timeout_seconds: float = 8.0

    @classmethod
    def from_environment(cls) -> "TencentRendererConfig | None":
        key = os.getenv("TENCENT_MAP_KEY")
        if not key:
            return None
        try:
            timeout = float(os.getenv("GARMIN_MAP_RENDER_TIMEOUT_SECONDS", "8"))
        except ValueError as error:
            raise BasemapRenderError("renderer_unhealthy") from error
        if timeout <= 0 or any(character.isspace() for character in key):
            raise BasemapRenderError("renderer_unhealthy")
        return cls(key, timeout)

    def fingerprint(self) -> str:
        return hashlib.sha256(TENCENT_RENDERER_VERSION.encode()).hexdigest()[:16]


@dataclass(frozen=True, slots=True)
class TencentQuota:
    current_qps: int | None = None
    limit_qps: int | None = None
    current_pv: int | None = None
    limit_pv: int | None = None

    @classmethod
    def from_header(cls, value: str | None) -> "TencentQuota | None":
        if not value:
            return None
        parsed: dict[str, object]
        try:
            candidate = json.loads(value)
            parsed = candidate if isinstance(candidate, dict) else {}
        except json.JSONDecodeError:
            parsed = {}
            for item in value.replace(";", ",").split(","):
                key, separator, raw = item.partition("=")
                if separator:
                    parsed[key.strip()] = raw.strip()

        def bounded_integer(key: str) -> int | None:
            try:
                result = int(parsed[key])
            except (KeyError, TypeError, ValueError):
                return None
            return result if result >= 0 else None

        quota = cls(
            bounded_integer("current_qps"),
            bounded_integer("limit_qps"),
            bounded_integer("current_pv"),
            bounded_integer("limit_pv"),
        )
        values = (quota.current_qps, quota.limit_qps, quota.current_pv, quota.limit_pv)
        return quota if any(value is not None for value in values) else None


class TencentStaticMapRenderer:
    """Request a clean Tencent basemap without disclosing the activity trace."""

    def __init__(self, config: TencentRendererConfig) -> None:
        self.config = config
        self.last_quota: TencentQuota | None = None

    def render(
        self, camera: MapCamera, points: list[tuple[float, float]]
    ) -> RenderedBasemap:
        converted_points = tuple(wgs84_to_gcj02(point) for point in points)
        center = wgs84_to_gcj02(
            (camera.center_latitude, camera.center_longitude)
        )
        # Tencent uses a 256px tile pyramid while MapCamera follows MapLibre's
        # 512px convention, so the equivalent Tencent zoom is one level higher.
        zoom = max(4, min(17, math.floor(camera.zoom) + 1))
        actual_camera = MapCamera(
            center[0], center[1], float(zoom - 1), camera.width, camera.height
        )
        query = urllib.parse.urlencode(
            {
                "center": f"{center[0]:.8f},{center[1]:.8f}",
                "zoom": str(zoom),
                "size": f"{camera.width}*{camera.height}",
                "scale": "2",
                "maptype": "roadmap",
                "key": self.config.key,
            }
        )
        request = urllib.request.Request(
            f"{TENCENT_STATIC_MAP_URL}?{query}",
            headers={"Accept": "image/png,image/jpeg"},
        )
        try:
            with urllib.request.urlopen(
                request, timeout=self.config.total_timeout_seconds
            ) as response:
                if getattr(response, "status", 200) != 200:
                    raise BasemapRenderError("renderer_http_error")
                content_type = response.headers.get_content_type()
                self.last_quota = TencentQuota.from_header(
                    response.headers.get("X-LIMIT")
                )
                if self.last_quota is not None:
                    LOGGER.info(
                        "Tencent map quota current_qps=%s limit_qps=%s "
                        "current_pv=%s limit_pv=%s",
                        self.last_quota.current_qps,
                        self.last_quota.limit_qps,
                        self.last_quota.current_pv,
                        self.last_quota.limit_pv,
                    )
                data = response.read(MAX_RASTER_BYTES + 1)
                if content_type not in {"image/png", "image/jpeg"}:
                    raise BasemapRenderError(_tencent_error_category(data))
        except BasemapRenderError:
            raise
        except TimeoutError as error:
            raise BasemapRenderError("renderer_timeout") from error
        except urllib.error.HTTPError as error:
            category = (
                "quota_exhausted"
                if error.code in {402, 429}
                else "renderer_http_error"
            )
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
            if all(
                high - low <= MAX_BLANK_CHANNEL_RANGE
                for low, high in rgb.getextrema()
            ):
                raise BasemapRenderError("invalid_raster")
            return RenderedBasemap(
                image.convert("RGBA"), actual_camera, converted_points
            )
        except BasemapRenderError:
            raise
        except Exception as error:
            raise BasemapRenderError("invalid_raster") from error


def _tencent_error_category(data: bytes) -> str:
    """Map Tencent's documented JSON status codes without exposing its body."""
    try:
        value = json.loads(data)
        status = int(value["status"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return "invalid_raster"
    if status in {120, 121}:
        return "quota_exhausted"
    if status in {110, 111, 112, 113, 160, 161, 190, 199}:
        return "asset_missing"
    if 300 <= status < 500:
        return "region_missing"
    return "renderer_http_error"


def configured_renderer() -> BasemapRenderer | None:
    config = TencentRendererConfig.from_environment()
    return TencentStaticMapRenderer(config) if config is not None else None


def check_renderer_health() -> bool:
    """Validate Tencent renderer configuration without disclosing location."""
    try:
        return TencentRendererConfig.from_environment() is not None
    except BasemapRenderError:
        return False


def configured_route_provider() -> str | None:
    try:
        return (
            "tencent"
            if TencentRendererConfig.from_environment() is not None
            else None
        )
    except BasemapRenderError:
        return None


def active_render_version() -> str:
    """Return a bounded fingerprint covering code, data, style, and renderer."""
    try:
        config = TencentRendererConfig.from_environment()
    except BasemapRenderError:
        return f"{COVER_RENDER_VERSION}-unconfigured"
    if config is None:
        return f"{COVER_RENDER_VERSION}-local"
    return f"{COVER_RENDER_VERSION}-tencent-{config.fingerprint()}"
