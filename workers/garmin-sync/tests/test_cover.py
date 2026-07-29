from io import BytesIO

from PIL import Image

from garmin_sync.cover import (
    COVER_HEIGHT,
    COVER_WIDTH,
    render_pin_cover,
    render_route_cover,
)


def assert_safe_webp(data: bytes) -> None:
    image = Image.open(BytesIO(data))
    assert image.format == "WEBP"
    assert image.size == (COVER_WIDTH, COVER_HEIGHT)
    assert "exif" not in image.info
    assert "gps" not in {key.casefold() for key in image.info}


def test_local_pin_cover_has_deterministic_dimensions_and_no_metadata(monkeypatch):
    first = render_pin_cover()
    second = render_pin_cover()
    assert first.image_data == second.image_data
    assert first.etag == second.etag
    assert first.provider == "local"
    assert_safe_webp(first.image_data)


def test_route_cover_falls_back_locally_without_tile_configuration(monkeypatch):
    for name in (
        "GARMIN_MAP_TILE_URL",
        "GARMIN_MAP_ATTRIBUTION",
        "GARMIN_MAP_PROVIDER",
    ):
        monkeypatch.delenv(name, raising=False)
    cover = render_route_cover([(22.50, 113.90), (22.51, 113.92), (22.53, 113.94)])
    assert cover.provider == "local-route"
    assert cover.attribution is None
    assert_safe_webp(cover.image_data)
