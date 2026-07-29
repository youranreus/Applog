import pytest

from garmin_sync.spatial import fit_camera


@pytest.mark.parametrize(
    "points",
    [
        [(22.5, 113.9), (22.50001, 113.90002)],
        [(22.5, 113.9), (22.5, 114.2)],
        [(22.5, 113.9), (22.7, 113.9)],
        [(0.0, 179.9), (0.0, -179.9)],
    ],
)
def test_fitted_camera_uses_408_pixel_centerline_span(points):
    camera = fit_camera(points, padding=32, overlay_radius=4)
    projected = [camera.project(point) for point in points]
    span = max(
        max(x for x, _ in projected) - min(x for x, _ in projected),
        max(y for _, y in projected) - min(y for _, y in projected),
    )

    assert span == pytest.approx(408, abs=0.02)


def test_single_point_uses_fixed_capped_zoom():
    camera = fit_camera([(22.5, 113.9)], point_zoom=15, max_zoom=12)

    assert camera.zoom == 12
    assert camera.project((22.5, 113.9)) == pytest.approx((240, 240))


def test_invalid_geometry_fails_before_rendering():
    with pytest.raises(ValueError, match="invalid_geometry"):
        fit_camera([(float("nan"), 1), (91, 2)])
