# Deployment Automation Contracts

> Completion criteria for every deployment, upgrade, migration, rollback, and
> production operations change in AppLog.

## Scenario: Deployable operations must ship as one-command automation

### 1. Scope / Trigger

This contract applies whenever a task adds or changes production deployment,
initial server setup, upgrades, database or data migration, service
registration, scheduled jobs, infrastructure assets, release activation,
rollback, backup/restore, or operational configuration.

A deployment-related task is incomplete unless it delivers both:

1. an executable, repository-owned automation entrypoint; and
2. documentation that explains the entrypoint, inputs, outcome, verification,
   and recovery.

Instructions that ask the user to perform the deployment as a sequence of shell
commands are not an acceptable substitute for automation.

### 2. Signatures

Every workflow must expose one stable command from the repository root:

```text
<package-manager-or-repo-command> <operation> [--config PATH] [--dry-run]
```

Examples include `pnpm deploy:production`, `./scripts/deploy production`, or a
component-local executable linked from the root command. The exact name may fit
the affected subsystem, but one documented invocation must own the complete
workflow.

The entrypoint must:

- run from a clean checkout on a supported host;
- detect the repository root instead of depending on the caller's directory;
- validate the host, permissions, tools, config, secrets, network access, disk
  space, and target before mutation;
- install or fetch required non-secret dependencies and assets itself when it
  is safe to do so, or exit with one precise unsupported-host error;
- execute setup, build/fetch, migration, registration, activation, and health
  verification in the correct order;
- be safe to rerun after success and after an interrupted run;
- support non-interactive execution. Interactive secret entry is permitted
  only when the secret cannot safely be sourced from the documented config or
  secret provider;
- return exit code `0` only after post-deployment verification succeeds, and a
  non-zero exit code for every incomplete or unhealthy outcome.

If rollback is operationally possible, expose it as a sibling one-command
entrypoint with an explicit release/backup identifier. Do not require users to
reverse the deployment steps manually.

### 3. Contracts

#### Inputs

- Required values come from a checked-in example config, documented environment
  contract, flags, or a supported secret provider.
- The script reports all missing inputs in a preflight phase before making
  changes; it must not reveal secret values.
- Defaults must be production-safe and documented. Destructive or ambiguous
  target selection requires an explicit value.
- Generated paths, release identifiers, service names, ports, and image tags
  are computed or validated by the script, not copied manually from prose.

#### Outputs

- Human-readable phase logs: `preflight`, `prepare`, `apply`, `verify`, and,
  when needed, `rollback`.
- A final success summary containing the deployed target and immutable release
  identifier when one exists.
- Actionable failures containing the failed phase, cause, and the single retry
  or rollback command. Documentation may explain failures, but must not turn a
  normal deployment into a manual command checklist.

#### Documentation

The same change must add or update a document that contains:

- the single command for first deployment and for upgrades;
- supported platforms and unavoidable external prerequisites, such as having a
  server, credentials, or a container runtime available;
- the input/config table, including where secrets come from;
- what the automation changes and how idempotency is achieved;
- success signals, health checks, rollback command, and troubleshooting;
- a clear boundary between prerequisites the project cannot create (account,
  DNS ownership, credentials) and work the script performs automatically.

“Prerequisite” must not be used to offload automatable work. Package
installation, artifact download, directory creation, permission wiring,
configuration rendering, database migration, systemd/cron registration,
service restart, and health verification belong inside the automation whenever
the supported platform allows them.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Required config or secret is missing | Fail during preflight, list the missing key(s), make no target changes |
| Unsupported OS, architecture, init system, or runtime | Fail during preflight with the supported alternatives |
| Required tool is absent but safely installable | Install a pinned/verified version or use a repository-contained implementation |
| Required tool cannot be installed automatically | Fail during preflight with one precise prerequisite and reason |
| Artifact download or checksum/signature verification fails | Do not activate; preserve the current healthy release |
| Migration or service registration fails | Stop, report the failed phase, and run/print the automated rollback path where safe |
| Health check fails after activation | Return non-zero and automatically restore the previous healthy release when supported |
| Script is rerun after success | Converge without duplicating services, timers, data, or config |
| Script is rerun after interruption | Resume safely or cleanly restart from a known checkpoint |
| `--dry-run` is supported | Validate and print the intended target/change set without mutating it |

### 5. Good / Base / Bad Cases

- Good: the operator supplies credentials/config and runs one repository command;
  it performs preflight, installs pinned dependencies, renders config, migrates,
  registers/restarts services, verifies health, and prints the release ID.
- Base: the host already contains every dependency and the desired version; the
  same command validates the state and exits successfully without duplicate work.
- Bad: documentation tells the operator to download an artifact, unpack it,
  create directories, edit a unit file, run migrations, enable a timer, restart
  a service, and then invoke a so-called deployment script.
- Bad: a wrapper only prints the manual commands, delegates required preparation
  to undocumented environment state, or exits successfully before health checks.

### 6. Tests Required

- Static contract test: the documented root invocation exists and `--help`
  matches the documented flags/config keys.
- Clean-host or container integration test: only declared external inputs are
  present; one invocation reaches a healthy state.
- Idempotency test: a second invocation causes no duplicate resources and keeps
  the service healthy.
- Missing-input preflight test: exits non-zero before mutation and names every
  missing key without leaking values.
- Interrupted/failing-phase test: leaves the prior release usable and proves the
  documented retry or rollback command works.
- Post-activation failure test: a failed health check cannot produce a success
  exit code or silently leave an unhealthy release active.
- Documentation review assertion: no required deployment step exists only as a
  manual command in prose.

When privileged host integration cannot run in normal CI, test the orchestration
with command doubles and maintain at least one reproducible container/VM smoke
test for the supported production path.

### 7. Wrong vs Correct

#### Wrong

```markdown
1. Install Docker, jq, and systemd units.
2. Download and unpack the release into `/opt/applog`.
3. Edit the environment file and run the migration commands below.
4. Run `./deploy.sh` to restart the service.
```

The script is only the final step; the user remains the deployment engine.

#### Correct

```markdown
Create the config from the checked-in example, provide secrets through the
documented provider, then run:

    pnpm deploy:production --config /etc/applog/deploy.env

The command preflights the host, prepares pinned dependencies and artifacts,
applies migrations and service configuration, activates the release, verifies
health, and reports the rollback command.
```

## Design Decision: Automation owns operational complexity

**Context**: A partial script plus a long prerequisite checklist is difficult to
repeat, test, recover, and hand over. It shifts project logic into an operator's
memory and makes documentation drift from production behavior.

**Decision**: Deployment knowledge is executable code first and supporting
documentation second. Humans provide only irreducible external authority or
data; repository automation owns every deterministic operational step.

**Extensibility**: New deployment steps must be added to the existing
orchestrator and its tests. Do not append a new manual step to the runbook.
