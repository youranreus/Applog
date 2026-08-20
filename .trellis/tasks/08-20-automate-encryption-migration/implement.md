# Implementation plan

## 1. Stabilize CLI inputs

- Add explicit `--env-file` / `--env-dir` loading to `manage-encryption`, reusing
  the existing worker dotenv priority implementation.
- Preserve process-environment precedence and redact all errors/output.
- Add parser and environment-loading tests without changing crypto or SQL logic.

## 2. Implement the orchestration command

- Add executable `workers/garmin-sync/migrate-app-secret` with strict Bash mode,
  path discovery, validated arguments, phase logging, and root/systemd checks.
- Implement `apply`, `apply --dry-run`, `rollback`, and `rollback --dry-run` using
  existing `manage-timer`, `manage-encryption`, and systemd service entrypoints.
- Ensure every mutating failure path leaves the timer disabled and prints exactly
  one redacted retry/rollback command.
- Verify controlled service completion and rerun database verification after it.
- On success, leave timer disabled and print exact enable/status commands.

## 3. Add orchestration tests

- Build command doubles in temporary directories and assert exact phase/call
  order for success, dry-run, active timer, missing input/tool/unit, preflight
  failure, migration failure, verify failure, sync failure, interruption, rerun,
  and rollback.
- Assert secrets and dotenv contents never appear in captured stdout/stderr.
- Assert dry-run never calls scheduler mutation, service start, or mutating
  migration commands.
- Assert success and failure outputs each contain the required single next-step
  command and that success never enables the timer.

## 4. Update operational contracts

- Replace the manual migration checklist in `docs/garmin-sync.md` with the one
  apply command, dry-run, one rollback command, inputs, success signals, and
  troubleshooting boundary.
- Update the Garmin Trellis spec with the stable command signature and timer
  handoff rule.
- Keep detailed lower-level commands as diagnostic reference only, not required
  routine production steps.

## 5. Verification gates

Run:

```text
cd workers/garmin-sync && pytest
cd workers/garmin-sync && ruff check .
workers/garmin-sync/migrate-app-secret --help
git diff --check
```

Also run the repository's backend tests/build if `manage-encryption` environment
contract changes any shared backend-facing file. Rehearse dry-run and apply with
command doubles, then use the local develop database only if a safe legacy fixture
can be restored without touching retained user evidence.

## Rollback and review gates

- The script itself never deletes database backups, ledger rows, legacy keys, or
  quarantine tables.
- No test may use the real systemd units or production environment source.
- Preserve unrelated notification changes in the dirty worktree.
- Before activation, the user reviews the final PRD/design/implementation summary
  and explicitly approves implementation.
