from io import BytesIO

import staticmaps
from PIL import Image

from garmin_sync.cover import (
    COVER_HEIGHT,
    COVER_WIDTH,
    DEFAULT_ROUTE_PADDING_PIXELS,
    render_pin_cover,
    render_route_cover,
    render_soccer_heatmap_cover,
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

    image = Image.open(BytesIO(cover.image_data)).convert("RGB")
    route_pixels = [
        (x, y)
        for y in range(COVER_HEIGHT)
        for x in range(COVER_WIDTH)
        if min(image.getpixel((x, y))) >= 190
    ]
    route_span = max(
        max(x for x, _ in route_pixels) - min(x for x, _ in route_pixels),
        max(y for _, y in route_pixels) - min(y for _, y in route_pixels),
    )
    assert route_span >= COVER_WIDTH - 2 * DEFAULT_ROUTE_PADDING_PIXELS - 12


def test_configured_route_cover_uses_tiles_and_reserves_route_padding(monkeypatch):
    monkeypatch.setenv("GARMIN_MAP_TILE_URL", "https://tiles.test/$z/$x/$y.png")
    monkeypatch.setenv("GARMIN_MAP_ATTRIBUTION", "Test maps")
    monkeypatch.setenv("GARMIN_MAP_PROVIDER", "test-provider")
    monkeypatch.delenv("GARMIN_MAP_ROUTE_PADDING_PIXELS", raising=False)

    tile_output = BytesIO()
    Image.new("RGB", (256, 256), "#26343c").save(tile_output, "PNG")
    requested_zooms: list[int] = []

    def get_tile(_self, _provider, _cache_dir, zoom, _x, _y):
        requested_zooms.append(zoom)
        return tile_output.getvalue()

    monkeypatch.setattr(staticmaps.tile_downloader.TileDownloader, "get", get_tile)

    cover = render_route_cover(
        [(22.50, 113.90), (22.51, 113.92), (22.53, 113.94)]
    )

    assert cover.provider == "test-provider"
    assert cover.attribution == "Test maps"
    assert cover.render_version == "garmin-cover-v3"
    assert requested_zooms == [14] * len(requested_zooms)
    assert requested_zooms
    assert_safe_webp(cover.image_data)

    image = Image.open(BytesIO(cover.image_data)).convert("RGB")
    route_pixels = [
        (x, y)
        for y in range(COVER_HEIGHT - 16)
        for x in range(COVER_WIDTH)
        if min(image.getpixel((x, y))) >= 190
    ]
    assert route_pixels
    route_bounds = (
        min(x for x, _ in route_pixels),
        min(y for _, y in route_pixels),
        max(x for x, _ in route_pixels),
        max(y for _, y in route_pixels),
    )
    assert route_bounds[0] >= DEFAULT_ROUTE_PADDING_PIXELS
    assert route_bounds[1] >= DEFAULT_ROUTE_PADDING_PIXELS
    assert COVER_WIDTH - route_bounds[2] > DEFAULT_ROUTE_PADDING_PIXELS
    assert COVER_HEIGHT - route_bounds[3] > DEFAULT_ROUTE_PADDING_PIXELS
    route_span = max(
        route_bounds[2] - route_bounds[0],
        route_bounds[3] - route_bounds[1],
    )
    assert route_span >= COVER_WIDTH - 2 * DEFAULT_ROUTE_PADDING_PIXELS - 12


def test_default_route_padding_keeps_the_route_visually_dominant():
    assert DEFAULT_ROUTE_PADDING_PIXELS == 28


def test_soccer_heatmap_is_derived_from_real_gps_samples():
    points = [
        (22.5000, 113.9000),
        (22.5004, 113.9002),
        (22.5008, 113.9004),
        (22.5004, 113.9002),
        (22.5004, 113.9002),
        (22.5011, 113.9008),
    ]

    first = render_soccer_heatmap_cover(points)
    second = render_soccer_heatmap_cover(points)

    assert first.image_data == second.image_data
    assert first.provider == "local-heatmap"
    assert first.attribution is None
    assert_safe_webp(first.image_data)

    image = Image.open(BytesIO(first.image_data)).convert("RGB")
    assert any(
        red >= 190 and green >= 95 and blue <= 100
        for red, green, blue in image.getdata()
    )


def test_soccer_without_distinct_gps_samples_uses_coordinate_free_cover():
    cover = render_soccer_heatmap_cover([(22.5, 113.9), (22.5, 113.9)])

    assert cover.provider == "local"
    assert_safe_webp(cover.image_data)


def test_route_padding_is_configurable_at_staticmaps_viewport_seam(monkeypatch):
    monkeypatch.setenv("GARMIN_MAP_TILE_URL", "https://tiles.test/$z/$x/$y.png")
    monkeypatch.setenv("GARMIN_MAP_ATTRIBUTION", "Test maps")
    monkeypatch.setenv("GARMIN_MAP_PROVIDER", "test-provider")
    monkeypatch.setenv("GARMIN_MAP_ROUTE_PADDING_PIXELS", "0")

    tile_output = BytesIO()
    Image.new("RGB", (256, 256), "#26343c").save(tile_output, "PNG")
    requested_zooms: list[int] = []

    def get_tile(_self, _provider, _cache_dir, zoom, _x, _y):
        requested_zooms.append(zoom)
        return tile_output.getvalue()

    monkeypatch.setattr(staticmaps.tile_downloader.TileDownloader, "get", get_tile)

    cover = render_route_cover(
        [(22.50, 113.90), (22.51, 113.92), (22.53, 113.94)]
    )

    assert cover.provider == "test-provider"
    assert requested_zooms == [15] * len(requested_zooms)
    assert requested_zooms
