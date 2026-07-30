import io
import json
import urllib.parse
from email.message import Message

import pytest
from PIL import Image, ImageDraw

from garmin_sync.map_renderer import (
    BasemapRenderError,
    TencentQuota,
    TencentRendererConfig,
    TencentStaticMapRenderer,
    configured_renderer,
    wgs84_to_gcj02,
)
from garmin_sync.spatial import fit_camera


def test_wgs84_to_gcj02_uses_known_mainland_control_point():
    latitude, longitude = wgs84_to_gcj02((39.908823, 116.39747))

    assert latitude == pytest.approx(39.9102265, abs=0.000001)
    assert longitude == pytest.approx(116.4037136, abs=0.000001)


def test_wgs84_to_gcj02_rejects_overseas_points():
    with pytest.raises(BasemapRenderError, match="region_missing"):
        wgs84_to_gcj02((51.5074, -0.1278))


def test_tencent_renderer_requests_only_camera_parameters(monkeypatch, caplog):
    output = io.BytesIO()
    image = Image.new("RGB", (960, 960), "#e8eee9")
    ImageDraw.Draw(image).line((0, 0, 960, 960), fill="#83908b", width=12)
    image.save(output, "PNG")
    headers = Message()
    headers["Content-Type"] = "image/png"
    headers["X-LIMIT"] = (
        '{"current_qps":1,"limit_qps":5,"current_pv":20,"limit_pv":100}'
    )

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
    camera = fit_camera([(22.5, 113.9), (22.51, 113.92)])
    renderer = TencentStaticMapRenderer(TencentRendererConfig("server-key"))

    rendered = renderer.render(camera, [(22.5, 113.9), (22.51, 113.92)])

    parsed = urllib.parse.urlparse(captured["url"])
    query = urllib.parse.parse_qs(parsed.query)
    assert set(query) == {"center", "zoom", "size", "scale", "maptype", "key"}
    assert query["size"] == ["480*480"]
    assert query["scale"] == ["2"]
    assert query["maptype"] == ["roadmap"]
    assert query["key"] == ["server-key"]
    assert "path" not in captured["url"]
    assert "marker" not in captured["url"]
    assert rendered.image.size == (960, 960)
    assert int(query["zoom"][0]) == min(17, int(camera.zoom) + 1)
    assert rendered.camera.zoom == float(int(query["zoom"][0]) - 1)
    assert rendered.points[0] != (22.5, 113.9)
    assert captured["timeout"] == 8
    assert renderer.last_quota == TencentQuota(1, 5, 20, 100)
    assert "server-key" not in caplog.text
    assert "22.5" not in caplog.text


def test_tencent_quota_accepts_json_and_key_value_headers():
    assert TencentQuota.from_header(
        '{"current_qps":2,"limit_qps":10,"current_pv":30,"limit_pv":1000}'
    ) == TencentQuota(2, 10, 30, 1000)
    assert TencentQuota.from_header(
        "current_qps=2;limit_qps=10;current_pv=30;limit_pv=1000"
    ) == TencentQuota(2, 10, 30, 1000)
    assert TencentQuota.from_header("unrecognized") is None


def test_configured_renderer_requires_explicit_tencent_key(monkeypatch):
    monkeypatch.delenv("TENCENT_MAP_KEY", raising=False)

    assert configured_renderer() is None

    monkeypatch.setenv("TENCENT_MAP_KEY", "server-key")
    assert isinstance(configured_renderer(), TencentStaticMapRenderer)


@pytest.mark.parametrize(
    ("status", "category"),
    [
        (120, "quota_exhausted"),
        (121, "quota_exhausted"),
        (190, "asset_missing"),
        (310, "region_missing"),
        (500, "renderer_http_error"),
    ],
)
def test_tencent_renderer_maps_json_errors_to_safe_categories(
    monkeypatch, status, category
):
    data = json.dumps({"status": status, "message": "sensitive"}).encode()
    headers = Message()
    headers["Content-Type"] = "application/json"

    class Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def read(self, limit):
            assert limit > len(data)
            return data

        @property
        def headers(self):
            return headers

    monkeypatch.setattr("urllib.request.urlopen", lambda *args, **kwargs: Response())
    camera = fit_camera([(22.5, 113.9), (22.51, 113.92)])

    with pytest.raises(BasemapRenderError, match=category):
        TencentStaticMapRenderer(TencentRendererConfig("server-key")).render(
            camera, [(22.5, 113.9), (22.51, 113.92)]
        )
