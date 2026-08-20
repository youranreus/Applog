# One-command encryption migration design

## Command boundary

Add one executable repository-owned orchestrator:

```text
./workers/garmin-sync/migrate-app-secret apply \
  --env-file PATH \
  --backup-id ID \
  [--venv PATH] \
  [--dry-run]

./workers/garmin-sync/migrate-app-secret rollback \
  --env-file PATH \
  --backup-id ID \
  [--venv PATH] \
  [--dry-run]
```

`--env-dir PATH` is mutually exclusive with `--env-file`. The script detects the
repository and worker directories from its own location. The production virtual
environment defaults to `/opt/applog/venvs/garmin-sync`; tests may override it.
The script supports Linux/systemd only and requires root for mutating operations.

The wrapper orchestrates existing owners:

- `manage-timer`: scheduler control;
- `manage-encryption`: database preflight/migrate/verify/rollback;
- `systemctl start applog-garmin-sync.service`: one controlled synchronization.

It must not reimplement key derivation, encryption, SQL migration, backup, ledger,
or timer registration logic.

## Environment loading

Extend the `manage-encryption` CLI boundary to accept the same explicit
`--env-file`/`--env-dir` source and reuse `garmin_sync.cli` dotenv loading. This
avoids shell-sourcing secrets and keeps the same production-over-development file
priority as the worker. Process-level variables remain higher priority.

The wrapper passes paths, never values. It may check that required variable names
are available through a redacted preflight, but must not run `env`, echo dotenv
contents, or interpolate secrets into commands/logs.

## Apply state machine

```text
preflight (dry-run)
  validate arguments, root/systemd, paths, executables, units, target env source
  inspect timer/service state and print the immutable backup id
  run manage-encryption preflight

prepare (mutating mode)
  disable timer through manage-timer
  verify timer and service inactive

preflight (mutating mode, after scheduler shutdown)
  run manage-encryption preflight and migration dry-run against a stable source

apply
  manage-encryption migrate --backup-id ID

verify
  manage-encryption verify --backup-id ID
  systemctl start applog-garmin-sync.service
  require inactive completed service with Result=success and ExecMainStatus=0
  manage-encryption verify --backup-id ID again to cover the controlled write
  require timer still disabled

complete
  print backup id and verification summary
  print exact `sudo <manage-timer> enable` and `<manage-timer> status` commands
  do not enable the timer
```

Dry-run executes safe argument/tool/environment checks plus cryptographic
preflight and `manage-encryption migrate --dry-run`. It does not disable/enable
the timer, start the worker, create backup/ledger state, or mutate rows. If the
timer is active it reports that apply would stop it rather than changing it.

## Failure behavior

Once mutating apply begins, every exit path leaves the timer disabled. A trap
records the current phase and prints one command:

- before a backup exists: rerun the same apply command;
- after migration begins or verify fails: run the exact rollback command with
  the same env source, venv, and backup id.

The trap never automatically rolls back because automatic rollback could hide
evidence or race an operator investigation. Errors expose phase and safe action,
not secrets or full subprocess commands containing values.

Apply is safe to rerun because `manage-encryption` owns source-version and backup
identity checks. The wrapper independently refuses an empty/invalid backup id,
unsupported units, a running service that cannot be stopped, or ambiguous env
input.

## Rollback state machine

Rollback dry-run validates arguments, tools, env source, backup existence/state,
and reports intended scheduler actions without mutation.

Mutating rollback disables the timer, verifies the worker inactive, invokes the
named `manage-encryption rollback`, verifies the database is legacy-readable,
and leaves the timer disabled. Its final output instructs the operator to deploy
the compatible old worker before running the printed enable/status commands; it
must not perform a controlled sync with the new worker against legacy data.

## Testing

Python subprocess tests execute the Bash orchestrator with a temporary fake
virtualenv and command doubles for `systemctl`, `manage-timer`, and
`manage-encryption`. They assert call order, arguments, exit status, no secret
leakage, dry-run non-mutation, timer-disabled failure behavior, success guidance,
idempotent rerun, and rollback behavior.

A static documentation test verifies that the documented command and `--help`
contract match. A real staging rehearsal remains required because CI cannot
faithfully emulate systemd and the production database together.

## Operational boundary

Irreducible prerequisites remain outside the command: code must already be
deployed, the environment source must exist with the three migration keys,
`keyVersion` schema must be present, the systemd units/worker virtualenv must be
installed, and the operator must possess root/database authority. Everything
from scheduler shutdown through verified migration is executable automation.
