import unittest

from garmin_sync.normalize import extract_detail_points, normalize_activity

PUBLIC_ACTIVITY = {
    "activityId": 42,
    "activityType": {"typeKey": "running"},
    "privacy": {"typeKey": "public"},
    "startTimeGMT": "2026-07-28 06:30:00",
    "distance": 5_123.4,
    "duration": 1_845.7,
    "deviceModel": "Forerunner 265",
}


class NormalizeActivityTests(unittest.TestCase):
    def test_normalizes_allowlisted_public_fields(self) -> None:
        snapshot = normalize_activity(PUBLIC_ACTIVITY)
        self.assertIsNotNone(snapshot)
        assert snapshot is not None
        self.assertEqual(snapshot.source_activity_id, "42")
        self.assertEqual(snapshot.activity_type, "running")
        self.assertEqual(snapshot.activity_type_display, "跑步")
        self.assertEqual(snapshot.started_at.isoformat(), "2026-07-28T06:30:00")
        self.assertEqual(snapshot.distance_meters, 5_123.4)
        self.assertEqual(snapshot.duration_seconds, 1_846)
        self.assertEqual(snapshot.device_source, "Forerunner 265")

    def test_unknown_or_private_visibility_fails_closed(self) -> None:
        for privacy in [None, {}, {"typeKey": "private"}, "public"]:
            activity = {**PUBLIC_ACTIVITY, "privacy": privacy}
            self.assertIsNone(normalize_activity(activity))

    def test_invalid_required_fields_are_rejected(self) -> None:
        for field in ["activityId", "activityType", "startTimeGMT", "duration"]:
            activity = {**PUBLIC_ACTIVITY}
            activity.pop(field)
            self.assertIsNone(normalize_activity(activity))

    def test_extracts_multiple_known_polyline_shapes(self) -> None:
        details = {
            "geoPolylineDTO": {
                "polyline": [
                    {"lat": 10.0, "lon": 20.0},
                    {"latitude": 10.1, "longitude": 20.1},
                    [10.2, 20.2],
                ]
            }
        }
        self.assertEqual(
            extract_detail_points(details),
            [(10.0, 20.0), (10.1, 20.1), (10.2, 20.2)],
        )


if __name__ == "__main__":
    unittest.main()
