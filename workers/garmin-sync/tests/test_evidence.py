from garmin_sync.evidence import (
    extract_activity_point,
    resolve_location_evidence,
)


def test_route_has_priority_over_activity_and_weather_points():
    evidence = resolve_location_evidence(
        [(22.5, 113.9), (22.6, 114.0)],
        activity_point=(1.0, 2.0),
        weather_payload={"latitude": 3.0, "longitude": 4.0},
    )

    assert evidence.kind == "route"
    assert evidence.provenance == "activity"


def test_one_route_point_is_activity_point():
    evidence = resolve_location_evidence(
        [(22.5, 113.9)],
        weather_payload={"latitude": 3.0, "longitude": 4.0},
    )

    assert evidence.kind == "point"
    assert evidence.points == ((22.5, 113.9),)
    assert evidence.provenance == "activity"


def test_weather_is_used_only_when_activity_has_no_point():
    evidence = resolve_location_evidence(
        [], weather_payload={"latitude": 22.5, "longitude": 113.9}
    )

    assert evidence.kind == "point"
    assert evidence.provenance == "weather"


def test_missing_or_invalid_coordinates_resolve_to_none():
    evidence = resolve_location_evidence(
        [], weather_payload={"latitude": 999, "longitude": 113.9}
    )

    assert evidence.kind == "none"
    assert evidence.points == ()


def test_activity_point_reads_only_explicit_coordinate_pairs():
    assert extract_activity_point(
        {"startLocation": {"startLatitude": 22.5, "startLongitude": 113.9}}
    ) == (22.5, 113.9)
    assert extract_activity_point({"locationName": "22.5, 113.9"}) is None
