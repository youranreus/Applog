import unittest
from datetime import UTC, datetime
from unittest.mock import patch

from garmin_sync.cover import ActivityCover
from garmin_sync.sync import SyncService


def activity(activity_id: int, privacy: str = "public") -> dict[str, object]:
    return {
        "activityId": activity_id,
        "activityType": {"typeKey": "running"},
        "privacy": {"typeKey": privacy},
        "startTimeGMT": "2026-07-28 06:30:00",
        "distance": 5_000,
        "duration": 1_800,
    }


class FakeAdapter:
    def count_activities(self) -> int:
        return 99

    def get_activities_by_date(self, start: str, end: str):
        self.range = (start, end)
        return [activity(1), activity(2, "private")]

    def get_route_points(self, activity_id: str):
        self.route_id = activity_id
        return [(10.0, 20.0), (10.1, 20.1)]

    def dump_tokens(self) -> str:
        return '{"safe":"synthetic"}'


class FakeRepository:
    def __init__(self) -> None:
        self.snapshots = []

    def processed_route_ids(self) -> set[str]:
        return set()

    def commit_success(self, **payload) -> None:
        self.payload = payload
        self.snapshots = payload["snapshots"]


class SyncServiceTests(unittest.TestCase):
    def test_syncs_only_public_activity_and_commits_one_atomic_success(self) -> None:
        adapter = FakeAdapter()
        repository = FakeRepository()
        now = datetime(2026, 7, 28, 12, tzinfo=UTC)

        result = SyncService(adapter, repository, now=lambda: now).run()

        self.assertEqual(result.total_count, 99)
        self.assertEqual(result.published_count, 1)
        self.assertEqual(len(repository.snapshots), 1)
        self.assertEqual(repository.snapshots[0].source_activity_id, "1")
        self.assertIsNotNone(repository.snapshots[0].route_path_data)
        self.assertEqual(adapter.range, ("2025-07-28", "2026-07-28"))
        self.assertEqual(repository.payload["token_json"], '{"safe":"synthetic"}')
        self.assertTrue(repository.payload["backfill_complete"])
        self.assertIsNone(repository.payload["backfill_cursor"])

    def test_route_work_is_running_only_and_bounded_by_attempts(self) -> None:
        raw = [activity(index) for index in range(1, 15)]
        raw.append(
            {
                **activity(99),
                "activityType": {"typeKey": "cycling"},
            }
        )
        adapter = FakeAdapter()
        adapter.get_activities_by_date = lambda start, end: raw
        attempted: list[str] = []

        def no_route(activity_id: str):
            attempted.append(activity_id)
            return []

        adapter.get_route_points = no_route
        repository = FakeRepository()

        SyncService(adapter, repository).run()

        self.assertEqual(len(attempted), 12)
        self.assertNotIn("99", attempted)
        self.assertFalse(repository.payload["backfill_complete"])
        self.assertIsNotNone(repository.payload["backfill_cursor"])

    def test_stale_cover_version_requeues_route_for_configured_provider(self) -> None:
        class VersionAwareRepository(FakeRepository):
            def processed_route_ids(self) -> set[str]:
                return {"1"}

            def covered_activity_ids(
                self, render_version: str, preferred_provider: str | None
            ) -> set[str]:
                self.cover_query = (render_version, preferred_provider)
                return set()

        adapter = FakeAdapter()
        repository = VersionAwareRepository()

        with (
            patch("garmin_sync.sync.active_render_version", return_value="v4-test"),
            patch(
                "garmin_sync.sync.configured_route_provider",
                return_value="protomaps",
            ),
        ):
            SyncService(adapter, repository).run()

        self.assertEqual(repository.cover_query, ("v4-test", "protomaps"))
        self.assertEqual(adapter.route_id, "1")

    def test_incomplete_provider_configuration_does_not_require_remote_provider(
        self,
    ) -> None:
        class VersionAwareRepository(FakeRepository):
            def covered_activity_ids(
                self, render_version: str, preferred_provider: str | None
            ) -> set[str]:
                self.cover_query = (render_version, preferred_provider)
                return {"1"}

            def processed_route_ids(self) -> set[str]:
                return {"1"}

        adapter = FakeAdapter()
        repository = VersionAwareRepository()

        with (
            patch("garmin_sync.sync.active_render_version", return_value="v4-local"),
            patch("garmin_sync.sync.configured_route_provider", return_value=None),
        ):
            SyncService(adapter, repository).run()

        self.assertEqual(repository.cover_query, ("v4-local", None))
        self.assertFalse(hasattr(adapter, "route_id"))

    def test_soccer_with_gps_uses_heatmap_cover_instead_of_route_cover(self) -> None:
        adapter = FakeAdapter()
        adapter.get_activities_by_date = lambda start, end: [
            {
                **activity(1),
                "activityType": {"typeKey": "soccer"},
            }
        ]

        class CoverRepository(FakeRepository):
            def store_activity_cover(self, source_activity_id, cover, *, generated_at):
                self.stored_cover = cover
                return "soccer-cover"

        repository = CoverRepository()
        heatmap = ActivityCover(
            b"heatmap", 480, 480, "heatmap-etag", "protomaps-heatmap", None
        )

        with patch(
            "garmin_sync.sync.render_activity_cover", return_value=heatmap
        ) as render_cover:
            SyncService(adapter, repository).run()

        activity_type, evidence = render_cover.call_args.args
        self.assertEqual(activity_type, "soccer")
        self.assertEqual(evidence.kind, "route")
        self.assertEqual(evidence.points, ((10.0, 20.0), (10.1, 20.1)))
        self.assertEqual(repository.stored_cover.provider, "protomaps-heatmap")
        self.assertEqual(repository.snapshots[0].cover_id, "soccer-cover")

    def test_indoor_activity_uses_archived_weather_as_a_private_point(self) -> None:
        adapter = FakeAdapter()
        adapter.get_activities_by_date = lambda start, end: [
            {
                **activity(1),
                "activityType": {"typeKey": "elliptical"},
            }
        ]

        class CoverRepository(FakeRepository):
            def get_activity_weather_payload(self, source_activity_id):
                self.weather_id = source_activity_id
                return {"latitude": 22.5, "longitude": 113.9}

            def store_activity_cover(self, source_activity_id, cover, *, generated_at):
                self.stored_cover = cover
                return "weather-cover"

        repository = CoverRepository()
        point_cover = ActivityCover(
            b"point", 480, 480, "point-etag", "protomaps-point", None
        )
        with patch(
            "garmin_sync.sync.render_activity_cover", return_value=point_cover
        ) as render_cover:
            SyncService(adapter, repository).run()

        _, evidence = render_cover.call_args.args
        self.assertEqual(evidence.kind, "point")
        self.assertEqual(evidence.provenance, "weather")
        self.assertEqual(repository.weather_id, "1")
        self.assertEqual(repository.snapshots[0].cover_id, "weather-cover")


if __name__ == "__main__":
    unittest.main()


def test_activity_backfill_indexes_whole_page_before_bounded_detail_queue():
    class ArchiveAdapter:
        def get_activities_page(self, start, limit):
            return [activity(index) for index in range(10, 15)]

        def get_activity_payloads(self, activity_id):
            return {"summary": {"averageHR": int(activity_id)}}

    class ArchiveRepository:
        def __init__(self):
            self.indexed = []
            self.details = []
            self.advanced = None

        def get_stream_cursor(self, stream_key):
            return "0", False

        def upsert_private_activity(self, item, *, seen_at):
            private_id = int(item.source_activity_id)
            self.indexed.append(private_id)
            return private_id

        def store_private_payload(self, **payload):
            return payload["payload_kind"] == "list"

        def activity_needs_detail(self, private_activity_id):
            return True

        def mark_activity_detail_pending(self, private_activity_id):
            pass

        def pending_activity_details(self, limit):
            return [(14, "14"), (13, "13")][:limit]

        def upsert_activity_detail(self, private_id, detail, *, status):
            self.details.append((private_id, status))

        def advance_stream(self, *args, **kwargs):
            self.advanced = (args, kwargs)

    repository = ArchiveRepository()
    service = SyncService(
        ArchiveAdapter(), repository, now=lambda: datetime(2026, 7, 28, tzinfo=UTC)
    )
    with patch.dict("os.environ", {"GARMIN_PRIVATE_ARCHIVE_ENABLED": "true"}):
        service._archive_private_activity_slice([], datetime(2026, 7, 28, tzinfo=UTC))

    assert repository.indexed == [10, 11, 12, 13, 14]
    assert repository.details == [(14, "partial"), (13, "partial")]
    assert repository.advanced is not None


def test_health_backfill_cursor_does_not_advance_on_partial_domain_failure():
    class HealthAdapter:
        def get_health_payloads(self, calendar_date):
            return ({"steps": {"totalSteps": 0}}, {"sleep"})

    class HealthRepository:
        def __init__(self):
            self.advanced = []
            self.statuses = []

        def get_stream_cursor(self, stream_key):
            return "2026-07-25", False

        def store_private_payload(self, **payload):
            return True

        def upsert_health_day(self, calendar_date, health, status):
            self.statuses.append(status)

        def advance_stream(self, *args, **kwargs):
            self.advanced.append((args, kwargs))

    repository = HealthRepository()
    service = SyncService(
        HealthAdapter(), repository, now=lambda: datetime(2026, 7, 28, tzinfo=UTC)
    )
    with patch.dict("os.environ", {"GARMIN_HEALTH_BACKFILL_ENABLED": "true"}):
        service._archive_health_days(datetime(2026, 7, 28, tzinfo=UTC))

    assert repository.advanced == []
    assert any(status.get("sleep") == "failed" for status in repository.statuses)
    assert all(status.get("steps") == "available" for status in repository.statuses)
