import math
import re
import unittest

from garmin_sync.route import build_route_preview


class RoutePreviewTests(unittest.TestCase):
    def test_preserves_complete_route_endpoints_inside_padded_viewbox(self) -> None:
        points = [(10.0, 20.0), (10.01, 20.02), (10.03, 20.01)]

        route = build_route_preview(points)

        self.assertIsNotNone(route)
        assert route is not None
        self.assertEqual(route.view_box, "0 0 100 100")
        self.assertRegex(
            route.path_data,
            r"^M \d+(?:\.\d+)? \d+(?:\.\d+)?"
            r"(?: L \d+(?:\.\d+)? \d+(?:\.\d+)?)+$",
        )
        coordinates = [
            tuple(map(float, pair))
            for pair in re.findall(r"(?:M|L) ([\d.]+) ([\d.]+)", route.path_data)
        ]
        self.assertGreaterEqual(len(coordinates), 2)
        for x, y in coordinates:
            self.assertGreaterEqual(x, 4)
            self.assertLessEqual(x, 96)
            self.assertGreaterEqual(y, 4)
            self.assertLessEqual(y, 96)
        self.assertNotEqual(coordinates[0], coordinates[-1])

    def test_filters_invalid_and_consecutive_duplicate_points(self) -> None:
        route = build_route_preview(
            [
                (math.nan, 10),
                (10.0, 20.0),
                (10.0, 20.0),
                (95.0, 20.0),
                (10.1, 20.1),
                (10.1, math.inf),
            ]
        )
        self.assertIsNotNone(route)
        assert route is not None
        self.assertEqual(route.path_data.count(" L "), 1)

    def test_returns_none_for_indoor_or_degenerate_tracks(self) -> None:
        self.assertIsNone(build_route_preview([]))
        self.assertIsNone(build_route_preview([(10.0, 20.0)]))
        self.assertIsNone(build_route_preview([(10.0, 20.0)] * 10))

    def test_caps_large_track_without_losing_endpoints(self) -> None:
        points = [
            (10 + index / 100_000, 20 + index / 100_000) for index in range(10_000)
        ]
        route = build_route_preview(points, max_points=320)
        self.assertIsNotNone(route)
        assert route is not None
        self.assertLessEqual(route.path_data.count(" L ") + 1, 320)

    def test_handles_pathological_zigzag_without_recursion(self) -> None:
        points = [
            (10 + index / 100_000, 20 + (index % 2) / 1_000) for index in range(4_000)
        ]
        route = build_route_preview(points, max_points=320)
        self.assertIsNotNone(route)
        assert route is not None
        self.assertLessEqual(route.path_data.count(" L ") + 1, 320)


if __name__ == "__main__":
    unittest.main()
