# Automate production encryption migration

## Goal

Replace the manual production runbook for the application master-key migration
with one repository-owned command that safely orchestrates the complete
maintenance window and leaves an actionable recovery path on every failure.

## Background

- `manage-encryption` already owns cryptographic preflight, migration, verify,
  rollback, database backups, ledger state, and advisory locks.
- `manage-timer` already owns systemd timer enable/disable/status behavior.
- `bootstrap --skip-provision --skip-sync` installs the worker and deliberately
  leaves its timer disabled.
- The current documentation still requires an operator to coordinate these
  tools manually, which violates the repository's one-command deployment
  automation contract and makes ordering mistakes likely.

## Requirements

- Add one stable command runnable from the repository/worker release that owns
  the production maintenance sequence.
- Accept an explicit environment file or environment directory, a unique backup
  id, worker virtualenv/runtime path, and supported scheduler mode.
- Provide a non-mutating `--dry-run` that validates target identity, required
  secrets by name, database connectivity/schema, tool availability, scheduler
  state, locks, legacy ciphertext readability, backup id, and intended actions.
- For the apply path, stop and verify the Garmin scheduler and worker before any
  database mutation; never rely on an operator remembering a separate command.
- Invoke existing `manage-encryption` behavior rather than duplicating its
  cryptographic or SQL implementation.
- Run preflight, migration dry-run, actual migration, and full verification in
  the required order with phase-labelled logs and non-zero failure exits.
- Run one controlled post-migration worker synchronization and verify its service
  result before declaring success.
- Keep the systemd timer disabled after successful migration and controlled
  synchronization. The final success output must print the exact `manage-timer
  enable` and `manage-timer status` commands for explicit operator approval.
- Never print keys, passwords, connection strings, dotenv contents, ciphertext,
  or plaintext.
- On failure, keep the timer disabled and print exactly one safe retry or named
  rollback command using the same inputs.
- Provide a sibling one-command rollback path that stops scheduling, restores
  the named backup, verifies legacy readability, and leaves scheduling disabled
  until the compatible old worker is restored.
- Be idempotent after success and after interruption; detect already migrated,
  rolled-back, mixed, unknown, or mismatched-backup states explicitly.
- Update the production runbook so routine migration is described as one command,
  with only irreducible prerequisites and recovery notes outside the script.

## Acceptance Criteria

- [ ] `--dry-run` performs all safe preflight checks and makes no scheduler,
  schema, ledger, backup-table, or encrypted-row mutation.
- [ ] One apply invocation stops scheduling, migrates, verifies, performs a
  controlled worker sync, and reports success only after every check succeeds;
  the timer remains disabled.
- [ ] Successful apply output ends with directly runnable timer enable and status
  commands, without executing either command itself.
- [ ] Any injected failure leaves the timer disabled, returns non-zero, and
  prints one redacted retry or rollback command.
- [ ] One rollback invocation restores and verifies the named legacy backup
  without enabling the incompatible new worker.
- [ ] Re-running apply/rollback converges safely or exits with a precise state
  explanation; it cannot silently duplicate or overwrite backups.
- [ ] Tests cover clean success, dry-run, missing inputs, active worker, failed
  preflight, failed migration/verify/sync, interruption, rerun, and rollback.
- [ ] The command help, implementation, docs, and deployment automation contract
  agree on arguments, phase order, success signals, and recovery behavior.

## Out of Scope

- Changing the HKDF/AES-GCM contract or migration SQL.
- Automatically deleting legacy keys, database backups, ledgers, or quarantine
  evidence.
- Automatically deploying source code or changing Function Compute triggers;
  the command may verify and reject unsupported scheduler state.
- Supporting arbitrary init systems beyond the documented systemd production
  deployment in the initial version.
