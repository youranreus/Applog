import sys
from types import SimpleNamespace

from garmin_sync.repository import MySQLRepository


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
