import sys
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

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
