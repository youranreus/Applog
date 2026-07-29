import sys
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

from garmin_sync.cover import ActivityCover
from garmin_sync.models import NormalizedHealthDaily
from garmin_sync.repository import MySQLRepository, _mysql_datetime


def test_mysql_datetime_matches_datetime_three_precision():
    value = datetime(2026, 7, 28, 11, 39, 46, 344123, tzinfo=UTC)

    assert _mysql_datetime(value) == datetime(2026, 7, 28, 11, 39, 46, 344000)


def test_repository_uses_garmin_mysql_environment(monkeypatch):
    captured = {}
    connection = object()

    def connect(**kwargs):
        captured.update(kwargs)
        return connection

    monkeypatch.setitem(sys.modules, "pymysql", SimpleNamespace(connect=connect))
    monkeypatch.setenv("GARMIN_MYSQL_SERVER", "garmin-db")
    monkeypatch.setenv("GARMIN_MYSQL_PORT", "3307")
    monkeypatch.setenv("GARMIN_MYSQL_USER", "garmin-user")
    monkeypatch.setenv("GARMIN_MYSQL_PASSWORD", "garmin-password")
    monkeypatch.setenv("GARMIN_MYSQL_DATABASE", "garmin-database")

    repository = MySQLRepository.from_environment(b"encryption-key")

    assert repository._connection is connection
    assert captured == {
        "host": "garmin-db",
        "port": 3307,
        "user": "garmin-user",
        "password": "garmin-password",
        "database": "garmin-database",
        "charset": "utf8mb4",
        "autocommit": True,
    }


def test_stream_cursor_sql_quotes_mysql_reserved_cursor_column():
    statements = []

    class Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def execute(self, sql, params):
            statements.append(sql)

        def fetchone(self):
            return ("page-2", False)

    connection = SimpleNamespace(cursor=lambda: Cursor())
    repository = MySQLRepository(connection, b"token-key")

    assert repository.get_stream_cursor("activity-list") == ("page-2", False)
    repository.advance_stream(
        "activity-list",
        "page-3",
        complete=False,
        succeeded_at=datetime(2026, 7, 29, tzinfo=UTC),
    )

    select_sql, upsert_sql = statements
    assert "SELECT `cursor`, backfillComplete" in select_sql
    assert "(streamKey, `cursor`, backfillComplete" in upsert_sql
    assert "UPDATE `cursor` = VALUES(`cursor`)" in upsert_sql


def test_covered_activity_ids_require_current_renderer_and_provider():
    captured = {}

    class Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def execute(self, sql, params):
            captured["sql"] = sql
            captured["params"] = params

        def fetchall(self):
            return [("activity-1",)]

    connection = SimpleNamespace(cursor=lambda: Cursor())
    repository = MySQLRepository(connection, b"token-key")

    assert repository.covered_activity_ids("garmin-cover-v3", "carto-dark") == {
        "activity-1"
    }
    assert "cover.renderVersion = %s" in captured["sql"]
    assert "cover.provider = %s" in captured["sql"]
    assert "activity.activityType = %s" in captured["sql"]
    assert "cover.provider IN (%s, %s)" in captured["sql"]
    assert "cover.provider <> %s" in captured["sql"]
    assert captured["params"] == (
        "garmin-cover-v3",
        "soccer",
        "local-heatmap",
        "local",
        "soccer",
        "local-heatmap",
        "carto-dark",
        "carto-dark",
    )


def test_activity_cover_skips_unchanged_immutable_content():
    statements = []
    rows = iter(
        [
            (7, "running"),
            ("existing-cover", "local-route", "same-etag", "garmin-cover-v3"),
        ]
    )

    class Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def execute(self, sql, params):
            statements.append((sql, params))

        def fetchone(self):
            return next(rows)

    connection = SimpleNamespace(cursor=lambda: Cursor(), begin=lambda: None)
    repository = MySQLRepository(connection, b"token-key")
    cover = ActivityCover(b"same", 480, 480, "same-etag", "local-route", None)

    assert (
        repository.store_activity_cover(
            "activity-1", cover, generated_at=datetime(2026, 7, 29, tzinfo=UTC)
        )
        == "existing-cover"
    )
    assert len(statements) == 2


def test_activity_cover_refreshes_currentness_metadata_without_rotating_id():
    statements = []
    rows = iter(
        [
            (7, "running"),
            ("existing-cover", "old-provider", "same-etag", "garmin-cover-v1"),
        ]
    )

    class Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def execute(self, sql, params):
            statements.append((sql, params))

        def fetchone(self):
            return next(rows)

    connection = SimpleNamespace(cursor=lambda: Cursor(), begin=lambda: None)
    repository = MySQLRepository(connection, b"token-key")
    cover = ActivityCover(
        b"same", 480, 480, "same-etag", "new-provider", "New attribution"
    )

    assert (
        repository.store_activity_cover(
            "activity-1", cover, generated_at=datetime(2026, 7, 29, tzinfo=UTC)
        )
        == "existing-cover"
    )
    assert len(statements) == 3
    metadata_sql, metadata_params = statements[2]
    assert "SET provider = %s" in metadata_sql
    assert metadata_params[:3] == (
        "new-provider",
        "New attribution",
        "garmin-cover-v3",
    )


def test_activity_cover_rotates_id_and_snapshot_reference_for_changed_content():
    statements = []
    rows = iter(
        [
            (7, "running"),
            ("existing-cover", "local-route", "old-etag", "garmin-cover-v1"),
        ]
    )

    class Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def execute(self, sql, params):
            statements.append((sql, params))

        def fetchone(self):
            return next(rows)

    transaction_calls = []
    connection = SimpleNamespace(
        cursor=lambda: Cursor(),
        begin=lambda: transaction_calls.append("begin"),
        commit=lambda: transaction_calls.append("commit"),
        rollback=lambda: transaction_calls.append("rollback"),
    )
    repository = MySQLRepository(connection, b"token-key")
    cover = ActivityCover(b"changed", 480, 480, "new-etag", "remote", "Map data")

    cover_id = repository.store_activity_cover(
        "activity-1", cover, generated_at=datetime(2026, 7, 29, tzinfo=UTC)
    )

    assert cover_id != "existing-cover"
    assert transaction_calls == ["begin", "commit"]
    update_cover_sql, update_cover_params = statements[2]
    update_snapshot_sql, update_snapshot_params = statements[3]
    assert "UPDATE garmin_activity_cover SET coverId = %s" in update_cover_sql
    assert update_cover_params[0] == cover_id
    assert "UPDATE garmin_activity_snapshot SET coverId = %s" in update_snapshot_sql
    assert update_snapshot_params == (cover_id, "activity-1")


def test_activity_type_correction_replaces_stale_soccer_heatmap():
    statements = []
    rows = iter(
        [
            (7, "running"),
            (
                "existing-cover",
                "local-heatmap",
                "old-etag",
                "garmin-cover-v3",
            ),
        ]
    )

    class Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def execute(self, sql, params):
            statements.append((sql, params))

        def fetchone(self):
            return next(rows)

    transaction_calls = []
    connection = SimpleNamespace(
        cursor=lambda: Cursor(),
        begin=lambda: transaction_calls.append("begin"),
        commit=lambda: transaction_calls.append("commit"),
        rollback=lambda: transaction_calls.append("rollback"),
    )
    repository = MySQLRepository(connection, b"token-key")
    cover = ActivityCover(b"route", 480, 480, "route-etag", "local-route", None)

    cover_id = repository.store_activity_cover(
        "activity-1", cover, generated_at=datetime(2026, 7, 29, tzinfo=UTC)
    )

    assert cover_id != "existing-cover"
    assert transaction_calls == ["begin", "commit"]
    assert "SELECT id, activityType" in statements[0][0]
    assert statements[2][1][6] == "local-route"


def test_health_upsert_writes_summary_and_source_boundaries_with_entity_parity():
    captured = {}

    class Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def execute(self, sql, params):
            captured["sql"] = sql
            captured["params"] = params

    connection = SimpleNamespace(cursor=lambda: Cursor())
    repository = MySQLRepository(connection, b"token-key")
    repository.upsert_health_day(
        "2026-07-28",
        NormalizedHealthDaily(
            {"steps": 0, "restingHeartRateBpm": None},
            datetime.fromisoformat("2026-07-28T00:00:00+08:00"),
            datetime.fromisoformat("2026-07-27T16:00:00+00:00"),
        ),
        {"steps": "available", "resting_heart_rate": "no_data"},
    )

    assert "localBoundaryStart" in captured["sql"]
    assert "gmtBoundaryStart" in captured["sql"]
    assert captured["params"][1] == datetime(2026, 7, 28, 0, 0)
    assert captured["params"][2] == datetime(2026, 7, 27, 16, 0)
    assert captured["params"][3] == '{"steps":0,"restingHeartRateBpm":null}'

    entity = (
        Path(__file__).resolve().parents[3]
        / "packages/backend/src/entities/GarminHealthDaily.ts"
    ).read_text()
    for property_name in (
        "calendarDate",
        "localBoundaryStart",
        "gmtBoundaryStart",
        "summaryData",
        "domainStatus",
    ):
        assert property_name in entity
