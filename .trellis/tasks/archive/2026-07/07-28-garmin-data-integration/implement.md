# Garmin 运动数据公开展示 — Implementation Plan

## Ordered Checklist

### 1. Establish contracts and fixtures

- Add shared Garmin Landing types and pure formatting/validation helpers in `packages/common`.
- Create synthetic activity, route and auth-error fixtures with no real account or geographic data.
- Write tests for public DTO shape, date/distance/duration normalization and SVG path grammar.

### 2. Add persistence and read API

- Add Garmin credential, activity snapshot and sync-state TypeORM entities; export them through the entity registry.
- Implement the NestJS Garmin repository/service/controller/module.
- Return `null` before first success, newest six published activities after success and persisted stale snapshots during worker failures.
- Register the module and add backend tests for ordering, limit, stale calculation, id omission and soft degradation.

### 3. Build the Python worker core

- Scaffold `workers/garmin-sync` for Python 3.12 with pinned `python-garminconnect`, MySQL client, crypto and test dependencies.
- Implement a narrow read-only Garmin adapter for count, dated activities, activity detail and GPX fallback.
- Implement AES-256-GCM token envelope handling and a local interactive provisioning CLI with MFA support.
- Implement payload normalization, public-visibility fail-closed filtering, idempotent upsert and sync lease/state handling.
- Implement bounded retry, `reauth_required`, checkpointed 12-month backfill and refreshed-token persistence.

### 4. Generate safe full-route SVG paths

- Implement coordinate validation, duplicate removal, local projection, endpoint-preserving simplification, normalization and path serialization.
- Persist only validated path data/viewBox; discard GPX/FIT bytes and coordinate arrays after each activity.
- Add unit/property-style cases for complete endpoint preservation, no GPS, indoor activity, single point, repeated points, invalid numbers and large tracks.

### 5. Add Landing presentation

- Add Garmin API method and isolated `useLandingGarminStats` request hook.
- Build the restrained Landing Garmin component with count, newest six activities, loading state, stale state and conditional SVG.
- Add accessible route labels and Garmin/device attribution.
- Integrate it without changing loading/error behavior of posts, weather or Duolingo.
- Add frontend utility/component tests where current test infrastructure supports them.

### 6. Configure deployment and operations

- Add a server bootstrap script, independent Python 3.12 virtualenv, systemd service and 30-minute timer, reusing backend dotenv priority and MySQL settings.
- Ensure deployment order: backend/schema -> worker code -> encrypted token provisioning -> timer enablement.
- Document local provisioning, reauthentication, manual worker invocation, trigger disablement and secret rotation.
- Verify no secret is included in deployment output, repository, logs or frontend bundle.

### 7. End-to-end verification

- Run against synthetic adapter fixtures first.
- With explicit user-controlled local credentials, perform one read-only live PoC: authenticate, count activities, fetch one public activity and verify route availability; do not retain real raw payload.
- Deploy with timer initially disabled, verify database/public API with a sanitized snapshot, then enable timer.
- Confirm repeated invocations are idempotent and upstream failure leaves the last snapshot available.

## Validation Commands

```bash
pnpm --filter @applog/common build
pnpm --filter @applog/backend test:unit
pnpm --filter @applog/backend build
pnpm --filter @applog/frontend test:unit
pnpm --filter @applog/frontend build
python3.12 -m pytest workers/garmin-sync/tests
python3.12 -m ruff check workers/garmin-sync
```

Run the worker live-account test separately and opt-in only; default test commands must remain credential-free.

## Risky Files and Rollback Points

- `workers/garmin-sync/bootstrap` and systemd templates: deploy the Node schema before bootstrap and keep the timer disabled until the first manual verification succeeds.
- `packages/backend/src/entities/index.ts` and `app.module.ts`: central registrations; additive edits only.
- System credential storage: never log or expose entity serialization; verify encryption with a negative wrong-key test.
- Route parser: upstream schema can vary; keep adapter fixtures and GPX fallback isolated from domain normalization.
- Landing integration: keep the Garmin request independent so removal is a one-component rollback.

## Pre-start Checks

- Confirm task remains in `planning` until the user approves the final summary.
- Use inline implementation flow; no sub-agent manifests are required under the current no-dispatch constraint.
- Before editing code, run `trellis-before-dev` and load relevant backend/frontend/common guidance.
- Do not use a real Garmin credential during ordinary implementation or tests.
- Confirm Python 3.12, systemd and the chosen low-privilege service user exist on the target server before deployment.
