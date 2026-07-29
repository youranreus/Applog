from io import BytesIO

from PIL import Image, ImageDraw

from garmin_sync.cover import (
    COVER_HEIGHT,
    COVER_WIDTH,
    DEFAULT_ROUTE_PADDING_PIXELS,
    NO_MAP_PROVIDER,
    PROTOMAPS_HEATMAP_PROVIDER,
    PROTOMAPS_POINT_PROVIDER,
    PROTOMAPS_ROUTE_PROVIDER,
    cover_provider_rank,
    render_no_map_cover,
    render_point_cover,
    render_route_cover,
    render_soccer_heatmap_cover,
)
from garmin_sync.map_renderer import BasemapRenderError


class FakeRenderer:
    def render(self, camera, points):
        del camera, points
        image = Image.new("RGBA", (960, 960), "#e8eee9")
        draw = ImageDraw.Draw(image)
        for position in range(80, 960, 120):
            draw.line((0, position, 960, position - 45), fill="#c4cfca", width=8)
            draw.line((position, 0, position - 45, 960), fill="#d4dcd8", width=5)
        return image


class FailingRenderer:
    def __init__(self, category="renderer_timeout"):
        self.category = category

    def render(self, camera, points):
        del camera, points
        raise BasemapRenderError(self.category)


def assert_safe_webp(data: bytes) -> Image.Image:
    image = Image.open(BytesIO(data))
    assert image.format == "WEBP"
    assert image.size == (COVER_WIDTH, COVER_HEIGHT)
    assert "exif" not in image.info
    assert "gps" not in {key.casefold() for key in image.info}
    return image


def test_coordinate_free_cover_is_explicit_and_deterministic():
    first = render_no_map_cover()
    second = render_no_map_cover()

    assert first.image_data == second.image_data
    assert first.provider == NO_MAP_PROVIDER
    assert first.outcome == "no_coordinates"
    assert first.attribution is None
    assert_safe_webp(first.image_data)


def test_mapped_point_preserves_private_provenance_only_in_worker_result():
    cover = render_point_cover(
        (22.5, 113.9), provenance="weather", renderer=FakeRenderer()
    )

    assert cover.provider == PROTOMAPS_POINT_PROVIDER
    assert cover.provenance == "weather"
    assert cover.attribution == "© OpenStreetMap contributors"
    assert cover.outcome == "map_success"
    assert_safe_webp(cover.image_data)


def test_route_uses_final_camera_and_keeps_visible_pixels_in_safe_area():
    cover = render_route_cover(
        [(22.5000, 113.9000), (22.5005, 113.9100), (22.5010, 113.9200)],
        renderer=FakeRenderer(),
    )

    assert cover.provider == PROTOMAPS_ROUTE_PROVIDER
    image = assert_safe_webp(cover.image_data).convert("RGB")
    route_pixels = [
        (x, y)
        for y in range(COVER_HEIGHT)
        for x in range(COVER_WIDTH)
        if (lambda rgb: rgb[0] < 70 and 45 < rgb[1] < 100 and rgb[2] < 95)(
            image.getpixel((x, y))
        )
    ]
    bounds = (
        min(x for x, _ in route_pixels),
        min(y for _, y in route_pixels),
        max(x for x, _ in route_pixels),
        max(y for _, y in route_pixels),
    )
    dominant_span = max(bounds[2] - bounds[0], bounds[3] - bounds[1])
    assert 412 <= dominant_span <= 420
    assert min(bounds[0], bounds[1]) >= DEFAULT_ROUTE_PADDING_PIXELS - 2
    assert COVER_WIDTH - max(bounds[2], bounds[3]) >= DEFAULT_ROUTE_PADDING_PIXELS - 2


def test_route_renderer_failure_is_typed_and_does_not_claim_a_map():
    cover = render_route_cover(
        [(22.5, 113.9), (22.51, 113.92)], renderer=FailingRenderer()
    )

    assert cover.provider == "local-route"
    assert cover.outcome == "fallback_created"
    assert cover.failure_category == "renderer_timeout"
    assert cover.attribution is None
    assert_safe_webp(cover.image_data)


def test_soccer_heatmap_uses_real_samples_over_the_basemap():
    points = [
        (22.5000, 113.9000),
        (22.5004, 113.9002),
        (22.5008, 113.9004),
        (22.5004, 113.9002),
        (22.5004, 113.9002),
        (22.5011, 113.9008),
    ]

    first = render_soccer_heatmap_cover(points, renderer=FakeRenderer())
    second = render_soccer_heatmap_cover(points, renderer=FakeRenderer())

    assert first.image_data == second.image_data
    assert first.provider == PROTOMAPS_HEATMAP_PROVIDER
    assert first.attribution == "© OpenStreetMap contributors"
    image = assert_safe_webp(first.image_data).convert("RGB")
    assert any(
        red >= 150 and red > green and blue < 120
        for red, green, blue in image.getdata()
    )


def test_soccer_without_distinct_samples_becomes_a_mapped_point():
    cover = render_soccer_heatmap_cover(
        [(22.5, 113.9), (22.5, 113.9)], renderer=FakeRenderer()
    )

    assert cover.provider == PROTOMAPS_POINT_PROVIDER
    assert_safe_webp(cover.image_data)


def test_soccer_renderer_failure_never_creates_a_mapless_heatmap():
    cover = render_soccer_heatmap_cover(
        [(22.5, 113.9), (22.51, 113.91)], renderer=FailingRenderer("asset_missing")
    )

    assert cover.provider == "fallback-no-map"
    assert cover.failure_category == "asset_missing"
    assert cover.attribution is None
    assert_safe_webp(cover.image_data)


def test_migration_providers_remain_retryable_without_allowing_downgrades():
    assert cover_provider_rank("carto-dark", "running") == cover_provider_rank(
        PROTOMAPS_ROUTE_PROVIDER, "running"
    )
    assert cover_provider_rank("carto-dark", "running") > cover_provider_rank(
        "local-route", "running"
    )
    assert cover_provider_rank("local-heatmap", "soccer") > cover_provider_rank(
        "fallback-no-map", "soccer"
    )
    assert cover_provider_rank("local-heatmap", "running") == -1
