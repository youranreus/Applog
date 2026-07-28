import os

from garmin_sync.cli import load_environment_directory


def test_environment_directory_uses_backend_file_priority(tmp_path, monkeypatch):
    key = "GARMIN_TEST_ENV_PRIORITY"
    monkeypatch.delenv(key, raising=False)
    (tmp_path / ".env").write_text(f"{key}=base\n", encoding="utf-8")
    (tmp_path / ".env.development.local").write_text(
        f"{key}=development-local\n", encoding="utf-8"
    )

    load_environment_directory(tmp_path)

    assert os.environ[key] == "development-local"
