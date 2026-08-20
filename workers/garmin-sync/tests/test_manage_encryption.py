import pytest

from garmin_sync.manage_encryption import _backup_tables


def test_backup_ids_are_strict_sql_identifiers():
    assert _backup_tables("release_20260820") == (
        "garmin_credential_backup_release_20260820",
        "garmin_payload_backup_release_20260820",
    )
    for value in ("", "has-dash", "contains space", "x" * 49, "name;DROP"):
        with pytest.raises(ValueError):
            _backup_tables(value)
