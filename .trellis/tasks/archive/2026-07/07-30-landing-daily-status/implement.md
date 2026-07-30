# Landing 今日状态展示 — Implementation Plan

## Ordered checklist

1. Add worker fixtures/tests for token profile initialization, unified daily summary mapping, intensity aliases, latest body battery, real sleep-score absence, zero/null handling and Garmin-local today/yesterday.
2. Implement worker authentication and health normalization changes; add privacy-safe field-coverage observability.
3. Extend common contracts with today metrics, sleep discriminant, evaluation status and config field.
4. Add backend repository projection, step-goal resolution, pure evaluation functions and `GET /garmin/today`; test whitelist/privacy, thresholds, time progress, missing confidence, stale/current-day behavior and errors.
5. Add admin `landingStepGoal` input with range validation and config round-trip tests.
6. Add frontend today-status API/hook and view utilities with unit tests for metric formatting and all availability states.
7. Add responsive `LandingTodayStatus` UI between recent posts and Garmin activities.
8. Add dependency-free CSS 3D procedural character, four motions, neutral pose and reduced-motion/static fallback.
9. Run focused tests, full type checks/lint/build, then visually verify representative desktop/mobile and reduced-motion states.
10. Update `.trellis/spec/backend/backend/garmin-guidelines.md` with the new executable cross-layer contract after behavior is verified.

## Validation commands

- `workers/garmin-sync/.venv/bin/pytest workers/garmin-sync/tests`
- `pnpm --filter @applog/common build`
- `pnpm --filter @applog/backend test`
- `pnpm --filter @applog/backend build`
- `pnpm --filter @applog/frontend test:unit`
- `pnpm --filter @applog/frontend type-check`
- `pnpm --filter @applog/frontend lint`
- `pnpm --filter @applog/frontend build`

## Risky files and rollback points

- `workers/garmin-sync/src/garmin_sync/adapter.py`: token initialization can affect every sync call; keep focused tests and preserve request budget/token refresh persistence.
- `workers/garmin-sync/src/garmin_sync/normalize.py`: field precedence must preserve valid zero and never overwrite a primary value with null fallback.
- backend Garmin DTO/service: enforce explicit allowlist; never serialize `summaryData` directly.
- system config contract: preserve older configs without `landingStepGoal`.
- CSS 3D: confirm the UI remains legible with animation disabled and without preserve-3d support.

## Pre-start checks

- Confirm PRD, design and implementation plan are explicitly approved after this final review.
- Run `trellis-before-dev` before code changes and load all affected common/backend/frontend specs.
- Do not use real health payloads in fixtures; synthesize only the minimum verified field shapes.
