import os
import signal
import subprocess
from pathlib import Path

import pytest

WORKER_DIR = Path(__file__).parents[1]
SCRIPT = WORKER_DIR / "migrate-app-secret"


def _executable(path: Path, body: str) -> None:
    path.write_text("#!/usr/bin/env bash\nset -euo pipefail\n" + body)
    path.chmod(0o755)


def _fixture(
    tmp_path: Path, command: str = "apply", *, env_dir: bool = False
) -> tuple[list[str], dict[str, str], Path]:
    log = tmp_path / "calls.log"
    environment = tmp_path / ("environment" if env_dir else "production.env")
    if env_dir:
        environment.mkdir()
        (environment / ".env.production.local").write_text(
            "APP_SECRET_ENCRYPTION_KEY=never-print-this-value\n"
        )
    else:
        environment.write_text("APP_SECRET_ENCRYPTION_KEY=never-print-this-value\n")
    venv = tmp_path / "venv"
    (venv / "bin").mkdir(parents=True)
    _executable(
        venv / "bin" / "manage-encryption",
        """printf 'manage-encryption %s\\n' "$*" >>"$CALL_LOG"
if [[ -n "${FAIL_MANAGE_MATCH:-}" && "$*" == *"$FAIL_MANAGE_MATCH" ]]; then
  exit 23
fi
if [[ -n "${INTERRUPT_MANAGE_MATCH:-}" && "$*" == *"$INTERRUPT_MANAGE_MATCH" ]]; then
  kill -TERM "$PPID"
fi
""",
    )
    timer = tmp_path / "manage-timer"
    _executable(
        timer,
        """printf 'manage-timer %s\\n' "$*" >>"$CALL_LOG"
if [[ "${FAIL_TIMER_DISABLE:-0}" == 1 && "${1:-}" == disable ]]; then exit 24; fi
""",
    )
    systemctl = tmp_path / "systemctl"
    _executable(
        systemctl,
        """printf 'systemctl %s\\n' "$*" >>"$CALL_LOG"
if [[ "${1:-}" == cat && "${FAIL_SYSTEMD_CAT:-0}" == 1 ]]; then exit 25; fi
if [[ "${1:-}" == stop && "${FAIL_SERVICE_STOP:-0}" == 1 ]]; then exit 26; fi
if [[ "${1:-}" == start && "${FAIL_SERVICE_START:-0}" == 1 ]]; then exit 27; fi
if [[ "${1:-}" == show ]]; then
  case "${4:-}" in
    ActiveState) echo "${SYNC_ACTIVE_STATE:-inactive}" ;;
    Result) echo "${SYNC_RESULT:-success}" ;;
    ExecMainStatus) echo "${SYNC_MAIN_STATUS:-0}" ;;
  esac
elif [[ "${1:-}" == is-active ]]; then
  if [[ "${3:-}" == applog-garmin-sync.timer && "${TIMER_ACTIVE:-0}" == 1 ]]; then
    exit 0
  fi
  if [[ "${3:-}" == applog-garmin-sync.service && "${SERVICE_ACTIVE:-0}" == 1 ]]; then
    exit 0
  fi
  exit 3
fi
""",
    )
    args = [
        command,
        "--env-dir" if env_dir else "--env-file",
        str(environment),
        "--backup-id",
        "release_1",
        "--venv",
        str(venv),
    ]
    env = {
        **os.environ,
        "CALL_LOG": str(log),
        "GARMIN_MIGRATION_TIMER_BIN": str(timer),
        "GARMIN_MIGRATION_SYSTEMCTL_BIN": str(systemctl),
        "GARMIN_MIGRATION_TEST_MODE": "1",
    }
    return args, env, log


def _run(args: list[str], env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [str(SCRIPT), *args], env=env, text=True, capture_output=True, check=False
    )


def test_apply_orders_commands_and_leaves_timer_disabled(tmp_path: Path):
    args, env, log = _fixture(tmp_path)
    result = _run(args, env)
    assert result.returncode == 0, result.stderr
    manage = f"manage-encryption --env-file {tmp_path / 'production.env'}"
    assert log.read_text().splitlines() == [
        "systemctl cat applog-garmin-sync.timer",
        "systemctl cat applog-garmin-sync.service",
        "manage-timer disable",
        "systemctl stop applog-garmin-sync.service",
        "systemctl is-active --quiet applog-garmin-sync.timer",
        "systemctl is-active --quiet applog-garmin-sync.service",
        f"{manage} preflight --dry-run",
        f"{manage} migrate --backup-id release_1 --dry-run",
        f"{manage} migrate --backup-id release_1",
        f"{manage} verify --backup-id release_1",
        "systemctl start applog-garmin-sync.service",
        "systemctl show applog-garmin-sync.service -p ActiveState --value",
        "systemctl show applog-garmin-sync.service -p Result --value",
        "systemctl show applog-garmin-sync.service -p ExecMainStatus --value",
        f"{manage} verify --backup-id release_1",
        "systemctl is-active --quiet applog-garmin-sync.timer",
    ]
    assert "manage-timer enable" in result.stdout
    assert "manage-timer status" in result.stdout
    assert "never-print-this-value" not in result.stdout + result.stderr


def test_env_directory_is_forwarded_without_loading_secrets_in_shell(tmp_path: Path):
    args, env, log = _fixture(tmp_path, env_dir=True)
    result = _run(args, env)
    assert result.returncode == 0, result.stderr
    assert f"--env-dir {tmp_path / 'environment'}" in log.read_text()
    assert "never-print-this-value" not in result.stdout + result.stderr


def test_dry_run_does_not_mutate_scheduler_or_database(tmp_path: Path):
    args, env, log = _fixture(tmp_path)
    env["TIMER_ACTIVE"] = "1"
    result = _run([*args, "--dry-run"], env)
    assert result.returncode == 0, result.stderr
    calls = log.read_text()
    assert "manage-timer" not in calls
    assert "systemctl stop" not in calls
    assert "systemctl start" not in calls
    assert " migrate --backup-id release_1\n" not in calls
    assert "would disable the active Garmin timer" in result.stdout


@pytest.mark.parametrize(
    ("args", "message"),
    [
        (["apply", "--backup-id", "release_1"], "select --env-file or --env-dir"),
        (
            [
                "apply",
                "--env-file",
                "/tmp/a",
                "--env-dir",
                "/tmp/b",
                "--backup-id",
                "release_1",
            ],
            "mutually exclusive",
        ),
        (
            ["apply", "--env-file", "/tmp/missing", "--backup-id", "has-dash"],
            "invalid backup id",
        ),
    ],
)
def test_argument_validation_rejects_ambiguous_or_invalid_inputs(
    args: list[str], message: str
):
    result = subprocess.run(
        [str(SCRIPT), *args], text=True, capture_output=True, check=False
    )
    assert result.returncode != 0
    assert message in result.stderr


def test_systemd_preflight_failure_is_non_mutating(tmp_path: Path):
    args, env, log = _fixture(tmp_path)
    env["FAIL_SYSTEMD_CAT"] = "1"
    result = _run(args, env)
    assert result.returncode != 0
    assert "manage-timer" not in log.read_text()
    assert "manage-encryption" not in log.read_text()


@pytest.mark.parametrize(
    ("failure_env", "failure_value", "expected_phase", "next_action"),
    [
        (
            "FAIL_MANAGE_MATCH",
            "preflight --dry-run",
            "cryptographic preflight",
            " apply ",
        ),
        (
            "FAIL_MANAGE_MATCH",
            "migrate --backup-id release_1 --dry-run",
            "migration dry-run",
            " apply ",
        ),
        (
            "FAIL_MANAGE_MATCH",
            "migrate --backup-id release_1",
            "migration",
            " rollback ",
        ),
        (
            "FAIL_MANAGE_MATCH",
            "verify --backup-id release_1",
            "verification",
            " rollback ",
        ),
        ("FAIL_SERVICE_START", "1", "controlled synchronization", " rollback "),
    ],
)
def test_mutating_failures_disable_timer_and_print_exactly_one_next_command(
    tmp_path: Path,
    failure_env: str,
    failure_value: str,
    expected_phase: str,
    next_action: str,
):
    args, env, log = _fixture(tmp_path)
    env[failure_env] = failure_value
    result = _run(args, env)
    assert result.returncode != 0
    assert f"phase: {expected_phase}" in result.stderr
    assert result.stderr.count("Next step:") == 1
    assert next_action in result.stderr
    assert log.read_text().splitlines()[-1] == "manage-timer disable"


def test_worker_that_remains_active_is_rejected_before_database_access(tmp_path: Path):
    args, env, log = _fixture(tmp_path)
    env["SERVICE_ACTIVE"] = "1"
    result = _run(args, env)
    assert result.returncode != 0
    calls = log.read_text()
    assert "manage-encryption" not in calls
    assert calls.splitlines()[-1] == "manage-timer disable"
    assert result.stderr.count("Next step:") == 1


def test_unsuccessful_controlled_sync_is_rejected(tmp_path: Path):
    args, env, log = _fixture(tmp_path)
    env["SYNC_RESULT"] = "exit-code"
    env["SYNC_MAIN_STATUS"] = "1"
    result = _run(args, env)
    assert result.returncode != 0
    assert "controlled Garmin synchronization did not complete" in result.stderr
    assert result.stderr.count("Next step:") == 1
    assert log.read_text().splitlines()[-1] == "manage-timer disable"


def test_interruption_after_mutation_starts_leaves_timer_disabled(tmp_path: Path):
    args, env, log = _fixture(tmp_path)
    env["INTERRUPT_MANAGE_MATCH"] = "migrate --backup-id release_1"
    result = _run(args, env)
    assert result.returncode == 128 + signal.SIGTERM
    assert result.stderr.count("Next step:") == 1
    assert log.read_text().splitlines()[-1] == "manage-timer disable"


def test_apply_rerun_uses_same_idempotent_sequence(tmp_path: Path):
    args, env, log = _fixture(tmp_path)
    first = _run(args, env)
    second = _run(args, env)
    assert first.returncode == second.returncode == 0
    calls = log.read_text().splitlines()
    midpoint = len(calls) // 2
    assert calls[:midpoint] == calls[midpoint:]


def test_rollback_dry_run_is_non_mutating(tmp_path: Path):
    args, env, log = _fixture(tmp_path, command="rollback")
    result = _run([*args, "--dry-run"], env)
    assert result.returncode == 0, result.stderr
    calls = log.read_text()
    assert " rollback --backup-id release_1 --dry-run" in calls
    assert "manage-timer" not in calls
    assert "systemctl stop" not in calls


def test_rollback_restores_after_shutdown_and_prints_manual_handoff(tmp_path: Path):
    args, env, log = _fixture(tmp_path, command="rollback")
    result = _run(args, env)
    assert result.returncode == 0, result.stderr
    manage = f"manage-encryption --env-file {tmp_path / 'production.env'}"
    assert log.read_text().splitlines() == [
        "systemctl cat applog-garmin-sync.timer",
        "systemctl cat applog-garmin-sync.service",
        "manage-timer disable",
        "systemctl stop applog-garmin-sync.service",
        "systemctl is-active --quiet applog-garmin-sync.timer",
        "systemctl is-active --quiet applog-garmin-sync.service",
        f"{manage} rollback --backup-id release_1 --dry-run",
        f"{manage} rollback --backup-id release_1",
    ]
    assert "Deploy the compatible legacy worker" in result.stdout
    assert "manage-timer enable" in result.stdout
    assert "manage-timer status" in result.stdout


def test_help_documents_stable_entrypoint():
    result = subprocess.run(
        [str(SCRIPT), "--help"], text=True, capture_output=True, check=False
    )
    assert result.returncode == 0
    assert "migrate-app-secret apply" in result.stdout
    assert "migrate-app-secret rollback" in result.stdout
    assert "--env-file PATH | --env-dir PATH" in result.stdout


def test_runbook_uses_the_stable_one_command_contract():
    runbook = (WORKER_DIR.parents[1] / "docs" / "garmin-sync.md").read_text()
    assert "sudo ./migrate-app-secret apply" in runbook
    assert "sudo ./migrate-app-secret rollback" in runbook
    assert "--env-file" in runbook
    assert "--backup-id" in runbook
    assert "timer 仍保持关闭" in runbook
