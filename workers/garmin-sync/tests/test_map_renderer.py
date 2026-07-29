import io
import json
import urllib.error
from email.message import Message

import pytest
from PIL import Image, ImageDraw

from garmin_sync.map_renderer import (
    BasemapRenderError,
    LocalMapRenderer,
    MapReleaseManifest,
    RendererConfig,
)
from garmin_sync.spatial import fit_camera


def manifest_file(tmp_path):
    path = tmp_path / "manifest.json"
    path.write_text(
        json.dumps(
            {
                "releaseId": "2026-07-test",
                "styleId": "applog-light",
                "styleVersion": "5.7.2",
                "rendererVersion": "1.11.0",
                "regions": [
                    {
                        "id": "public-fixture",
                        "bounds": [113.0, 22.0, 115.0, 24.0],
                        "maxZoom": 24,
                    },
                    {
                        "id": "global-low",
                        "bounds": [-180, -85, 180, 85],
                        "maxZoom": 6,
                    },
                ],
            }
        )
    )
    return path


def test_manifest_selects_detail_region_without_stretching_global_data(tmp_path):
    manifest = MapReleaseManifest.load(manifest_file(tmp_path))

    assert manifest.supports([(22.5, 113.9)], 15)
    assert not manifest.supports([(51.5, -0.1)], 15)
    assert manifest.supports([(51.5, -0.1)], 6)


def test_renderer_configuration_rejects_non_loopback_url(tmp_path, monkeypatch):
    monkeypatch.setenv("GARMIN_MAP_RENDERER_URL", "https://maps.example.com")
    monkeypatch.setenv("GARMIN_MAP_RELEASE_MANIFEST", str(manifest_file(tmp_path)))

    with pytest.raises(BasemapRenderError, match="renderer_unhealthy"):
        RendererConfig.from_environment()


def test_renderer_validates_webp_dimensions_and_uses_camera_endpoint(
    tmp_path, monkeypatch
):
    output = io.BytesIO()
    image = Image.new("RGB", (960, 960), "#e8eee9")
    ImageDraw.Draw(image).line((0, 0, 960, 960), fill="#83908b", width=12)
    image.save(output, "WEBP")
    headers = Message()
    headers["Content-Type"] = "image/webp"

    class Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def read(self, limit):
            assert limit > len(output.getvalue())
            return output.getvalue()

        @property
        def headers(self):
            return headers

    captured = {}

    def urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["timeout"] = timeout
        return Response()

    monkeypatch.setattr("urllib.request.urlopen", urlopen)
    config = RendererConfig(
        "http://127.0.0.1:3000",
        MapReleaseManifest.load(manifest_file(tmp_path)),
    )
    camera = fit_camera([(22.5, 113.9)])

    rendered = LocalMapRenderer(config).render(camera, [(22.5, 113.9)])

    assert rendered.size == (960, 960)
    assert "/style/applog-light/static/" in captured["url"]
    assert captured["url"].endswith("/480x480@2x.webp")
    assert captured["timeout"] == 8


def test_renderer_reports_region_missing_before_http(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda *args, **kwargs: pytest.fail("HTTP must not be called"),
    )
    config = RendererConfig(
        "http://127.0.0.1:3000",
        MapReleaseManifest.load(manifest_file(tmp_path)),
    )
    camera = fit_camera([(51.5, -0.1)])

    with pytest.raises(BasemapRenderError, match="region_missing"):
        LocalMapRenderer(config).render(camera, [(51.5, -0.1)])


@pytest.mark.parametrize(
    ("size", "color", "content_type"),
    [
        ((480, 480), "#e8eee9", "image/webp"),
        ((960, 960), "#e8eee9", "image/png"),
        ((960, 960), "#e8eee9", "image/webp"),
    ],
)
def test_renderer_rejects_wrong_dimensions_content_type_and_blank_raster(
    tmp_path, monkeypatch, size, color, content_type
):
    output = io.BytesIO()
    Image.new("RGB", size, color).save(output, "WEBP")
    headers = Message()
    headers["Content-Type"] = content_type

    class Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def read(self, limit):
            del limit
            return output.getvalue()

        @property
        def headers(self):
            return headers

    monkeypatch.setattr("urllib.request.urlopen", lambda *args, **kwargs: Response())
    config = RendererConfig(
        "http://127.0.0.1:3000",
        MapReleaseManifest.load(manifest_file(tmp_path)),
    )
    camera = fit_camera([(22.5, 113.9)])

    with pytest.raises(BasemapRenderError, match="invalid_raster"):
        LocalMapRenderer(config).render(camera, [(22.5, 113.9)])


@pytest.mark.parametrize(
    ("error", "category"),
    [
        (TimeoutError(), "renderer_timeout"),
        (urllib.error.URLError("offline"), "renderer_unhealthy"),
        (
            urllib.error.HTTPError("loopback", 404, "missing", {}, None),
            "asset_missing",
        ),
        (
            urllib.error.HTTPError("loopback", 500, "failed", {}, None),
            "renderer_http_error",
        ),
    ],
)
def test_renderer_maps_transport_failures_to_safe_categories(
    tmp_path, monkeypatch, error, category
):
    def fail(*args, **kwargs):
        raise error

    monkeypatch.setattr("urllib.request.urlopen", fail)
    config = RendererConfig(
        "http://127.0.0.1:3000",
        MapReleaseManifest.load(manifest_file(tmp_path)),
    )
    camera = fit_camera([(22.5, 113.9)])

    with pytest.raises(BasemapRenderError, match=category):
        LocalMapRenderer(config).render(camera, [(22.5, 113.9)])
