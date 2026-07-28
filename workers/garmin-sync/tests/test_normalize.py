import unittest

from garmin_sync.normalize import extract_detail_points, normalize_activity

PUBLIC_ACTIVITY = {
    "activityId": 42,
    "activityType": {"typeKey": "running"},
    "privacy": {"typeKey": "public"},
    "startTimeGMT": "2026-07-28 06:30:00",
    "distance": 5_123.4,
    "duration": 1_845.7,
    "calories": 342.6,
    "locationName": "深圳湾公园",
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
        self.assertEqual(snapshot.calories, 343)
        self.assertEqual(snapshot.location_name, "深圳湾公园")
        self.assertEqual(snapshot.device_source, "Forerunner 265")

    def test_maps_required_chinese_type_labels(self) -> None:
        for type_key, label in [
            ("elliptical", "椭圆机"),
            ("track_running", "操场跑步"),
            ("soccer", "足球"),
            ("indoor_cycling", "室内骑行"),
            ("strength_training", "力量训练"),
        ]:
            activity = {
                **PUBLIC_ACTIVITY,
                "activityType": {"typeKey": type_key},
            }
            snapshot = normalize_activity(activity)
            self.assertIsNotNone(snapshot)
            assert snapshot is not None
            self.assertEqual(snapshot.activity_type, type_key)
            self.assertEqual(snapshot.activity_type_display, label)

    def test_unknown_type_falls_back_to_readable_label(self) -> None:
        activity = {
            **PUBLIC_ACTIVITY,
            "activityType": {"typeKey": "custom_workout"},
        }
        snapshot = normalize_activity(activity)
        self.assertIsNotNone(snapshot)
        assert snapshot is not None
        self.assertEqual(snapshot.activity_type_display, "custom workout")

    def test_calories_reject_invalid_values(self) -> None:
        for calories in [-1, float("nan"), float("inf"), "120", None]:
            activity = {**PUBLIC_ACTIVITY, "calories": calories}
            snapshot = normalize_activity(activity)
            self.assertIsNotNone(snapshot)
            assert snapshot is not None
            self.assertIsNone(snapshot.calories)

    def test_location_name_sanitization(self) -> None:
        cases = [
            ({"locationName": "  南山海岸线  "}, "南山海岸线"),
            ({"locationName": "", "location": "市民中心"}, "市民中心"),
            ({"locationName": "22.5, 114.0"}, None),
            ({"locationName": "lat 22.5 lon 114.0"}, None),
            ({"locationName": "a" * 80}, "a" * 64),
            ({"locationName": None, "location": {"name": "x"}}, None),
        ]
        for fields, expected in cases:
            activity = {**PUBLIC_ACTIVITY}
            activity.pop("locationName", None)
            activity.update(fields)
            snapshot = normalize_activity(activity)
            self.assertIsNotNone(snapshot)
            assert snapshot is not None
            self.assertEqual(snapshot.location_name, expected)

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
