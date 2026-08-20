from pathlib import Path

import pytest

from garmin_sync import manage_encryption
from garmin_sync.manage_encryption import _backup_tables


def test_backup_ids_are_strict_sql_identifiers():
    assert _backup_tables("release_20260820") == (
        "garmin_credential_backup_release_20260820",
        "garmin_payload_backup_release_20260820",
    )
    for value in ("", "has-dash", "contains space", "x" * 49, "name;DROP"):
        with pytest.raises(ValueError):
            _backup_tables(value)


def test_cli_loads_explicit_environment_before_dispatch(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("MIGRATION_ENV_TEST=loaded\n")
    observed = []
    monkeypatch.delenv("MIGRATION_ENV_TEST", raising=False)

    def observe(**kwargs):
        observed.append((kwargs, __import__("os").environ.get("MIGRATION_ENV_TEST")))

    monkeypatch.setattr(manage_encryption, "preflight", observe)

    manage_encryption.main(["--env-file", str(env_file), "preflight", "--dry-run"])

    assert observed == [({"dry_run": True}, "loaded")]


def test_cli_requires_exactly_one_environment_source(tmp_path: Path):
    with pytest.raises(SystemExit):
        manage_encryption.main(["preflight"])


def test_cli_loads_environment_directory_before_dispatch(tmp_path, monkeypatch):
    (tmp_path / ".env.production.local").write_text(
        "MIGRATION_ENV_DIRECTORY_TEST=loaded\n"
    )
    observed = []
    monkeypatch.delenv("MIGRATION_ENV_DIRECTORY_TEST", raising=False)
    monkeypatch.setattr(
        manage_encryption,
        "preflight",
        lambda **kwargs: observed.append(
            __import__("os").environ.get("MIGRATION_ENV_DIRECTORY_TEST")
        ),
    )

    manage_encryption.main(["--env-dir", str(tmp_path), "preflight"])

    assert observed == ["loaded"]
