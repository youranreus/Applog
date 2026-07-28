import unittest
from datetime import UTC, datetime

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


if __name__ == "__main__":
    unittest.main()
