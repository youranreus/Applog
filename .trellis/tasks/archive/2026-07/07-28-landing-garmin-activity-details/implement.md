# Landing Garmin 活动明细与地图交互 — Implementation Plan

## Before Start

- Do not run `task.py start` until the user explicitly approves the final planning summary.
- At Phase 2 start, run `trellis-before-dev` and reload worker/backend/common/frontend specs.
- Back up production Garmin tables and verify the TypeORM `synchronize` schema diff before deploying the worker.
- Use only synthetic fixtures derived from `research/field-capability.md`; never commit real account payloads.

## Ordered Checklist

### 1. Contracts and schema skeleton

- Extend `packages/common/src/types/garmin.ts` with public id, cover and typed activity-detail contracts.
- Add private activity, private payload, normalized detail, daily health, stream state and cover TypeORM entities.
- Register entities in `ENTITY_LIST` and `GarminModule.forFeature`.
- Extend the public snapshot entity with nullable `publicId`, `detailData` and `coverId`.
- Align camelCase TypeORM column names with Python SQL.
- Add schema-level uniqueness/indexes for activity ids, payload ownership/kind, calendar dates, stream keys and public ids.

### 2. Private encryption and payload codec

- Add `GARMIN_DATA_ENCRYPTION_KEY` config with a key separate from token encryption.
- Implement canonical JSON → gzip → AES-256-GCM and matching decode helpers.
- Bind AAD to domain/owner/payload kind/version.
- Add deterministic content hashing and size guards.
- Unit-test tampering, wrong AAD/key, gzip errors, canonical hash stability and binary FIT payloads.

### 3. Read-only Garmin adapter expansion

- Add narrow adapter methods for:
  - paged activity list and summary;
  - details, splits, typed splits, split summaries;
  - weather, HR/power zones, gear;
  - FIT download;
  - all agreed daily health domains.
- Keep write/upload/delete APIs unreachable from the adapter interface.
- Add retry/backoff classification for authentication, rate limit, unavailable domain and schema error.
- Freeze synthetic fixtures for the eight real type keys and health response shapes.

### 4. Repository and stream cursors

- Implement idempotent private activity/payload upserts.
- Implement normalized activity detail and health daily upserts.
- Implement per-stream cursor/state reads and atomic advances.
- Fix local/systemd/FC MySQL env-name compatibility.
- Preserve old snapshots on partial/upstream failures.
- Add repository SQL tests that assert TypeORM/Python column parity and cursor non-advancement on rollback.

### 5. Incremental sync and historical backfill

- Refactor the current single 12-month snapshot run into a bounded stream orchestrator.
- Always process recent incremental activities and today/yesterday health before historical backfill.
- Backfill all available activity pages and daily health dates with resumable cursors.
- Use a global per-invocation request budget and persist partial-domain status.
- Stop deleting activity rows by age.
- Reconcile deleted/private-changed activities out of the public projection without deleting private history.
- Verify repeated invocations are idempotent and that delayed Garmin edits are absorbed by recent-window refresh.

### 6. Public projection

- Normalize all safe detail fields into `garmin_activity_detail`.
- Build the public detail JSON only for explicit `public/everyone` activities.
- Generate stable random `publicId`; never derive it from Garmin ids.
- Keep newest-six ordering, stale behavior and existing total count semantics.
- Test all eight metric presets, null omission, valid zero retention and elliptical distance de-emphasis.

### 7. Static map covers

- Add pinned `py-staticmaps`, Pillow and required pure-Python dependencies.
- Implement provider config, identifiable User-Agent, attribution and tile cache.
- Render outdoor route at 2x with generous padding, then LANCZOS downsample and WebP encode.
- Render indoor/no-GPS centered-pin WebP locally.
- Strip metadata and store hash/size/dimensions/provider/render version.
- Generate only current public candidates; preserve last good image on failure.
- Add synthetic route snapshot/image tests for bounds, padding, attribution, metadata absence and deterministic dimensions.

### 8. Backend public APIs

- Extend `GarminService.getLandingStats` with safe public id and cover descriptor.
- Add lazy `GET /garmin/activities/:publicId`, restricted to published projection rows.
- Add raw `GET /garmin/covers/:coverId.webp` response with ETag, immutable caching and correct content type.
- Return `BusinessException`/null according to existing soft-degradation conventions.
- Assert JSON never contains source ids, coordinates, raw payloads, FIT, health data or private visibility.

### 9. Frontend presentation and interaction

- Extend `src/api/garmin` and the Landing hook for lazy activity detail.
- Split the current SFC into focused page-local components/hooks:
  - activity card;
  - cover;
  - detail dialog;
  - metric preset/formatting;
  - pointer tilt;
  - shared-element transition.
- Preserve the horizontal track and conditional edge fades.
- Replace GPS SVG with WebP when available; keep SVG as fallback.
- Implement bounded pointer-fine tilt and reset on leave/blur/scroll/open.
- Reuse Reka `Dialog`; implement clone-based WAAPI/FLIP open and reverse-close transition.
- Add desktop two-column and mobile vertical detail layouts.
- Implement summary-first loading, retry state and per-id in-memory detail cache.
- Respect keyboard, touch and `prefers-reduced-motion`.

### 10. Cross-layer verification and production proof

- Run worker unit/integration tests against synthetic payloads.
- Run common/backend/frontend build, tests, type-check and file-scoped lint.
- Run a real read-only account probe and one bounded staging sync; inspect counts and error categories without logging values.
- Validate schema diff and rollback flags before enabling the timer.
- Browser-test mouse tilt, horizontal scroll, keyboard open/Escape/focus return, mobile detail, reduced motion, missing cover and stale snapshot.
- Confirm browser network/JSON contains no coordinates, source ids or health payloads.
- Enable streams gradually: archive → health → covers → public detail/UI.

## Validation Commands

```bash
cd workers/garmin-sync
.venv/bin/python -m pytest -q
.venv/bin/python -m ruff check src tests

cd ../..
pnpm --filter @applog/common run build
pnpm --filter @applog/backend run test:unit
pnpm --filter @applog/backend run build
pnpm --filter @applog/frontend run test:unit
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run build-only
git diff --check
```

Use file-scoped ESLint/Oxlint checks for touched frontend files so verification does not rewrite unrelated files.

## Risky Files / Rollback Points

| Area | Risk | Guard / rollback |
|---|---|---|
| `packages/backend/src/entities/*Garmin*` | `synchronize: true` schema drift | backup + inspect staging diff; deploy entities before worker |
| `workers/garmin-sync/src/garmin_sync/repository.py` | direct SQL/TypeORM mismatch | SQL parity tests; one transaction per cursor advance |
| sync orchestration | rate limits and never-finishing backfill | global request budget, resumable streams, incremental-first |
| encrypted payloads | unrecoverable data on key loss | separate versioned key, deployment secret backup, test decode before cursor advance |
| map provider | terms/outage/China reachability | configurable provider, cached cover, SVG fallback, independent stream |
| public projection | accidental sensitive-field leak | typed whitelist DTO + forbidden-key tests + browser network inspection |
| shared animation | clipped/stranded clone or focus loss | cancel/resize cleanup, Dialog owns focus, reduced-motion fallback |

## Follow-up Checks Before `task.py start`

- `prd.md` has no blocking open question and matches the final user decisions.
- `design.md` explicitly separates private archive, normalized data and public projection.
- Map provider deployment configuration and legal attribution are recorded.
- Field capability research contains no real values or identifiers.
- Latest planning summary has been presented and explicitly approved in a later user message.
