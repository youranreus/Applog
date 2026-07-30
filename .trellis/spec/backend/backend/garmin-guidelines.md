# Garmin Landing Activity Snapshot Contract

> Cross-layer contract for the systemd Python worker, public NestJS snapshot API, and Landing activity cards.

## Scenario: Public Landing today status

### 1. Scope / Trigger

- Trigger: Garmin daily-health ingestion, `garmin_health_daily`, the public today
  endpoint, `landingStepGoal`, server evaluation, or the Landing today-status UI.
- Data flow is worker → MySQL → NestJS allowlist → shared contract → Vue. The
  public request never calls Garmin upstream.

### 2. Signatures

- Worker input: `daily_summary` plus optional health domains for the same Garmin
  local calendar date.
- DB: `garmin_health_daily.summaryData` remains private.
- Public API: `GET /garmin/today` → `IGarminTodayStatus | null`.
- System config: optional `landingStepGoal` integer from 1,000 through 100,000.

### 3. Contracts

- Restore tokens through the Garmin library login/profile initialization path;
  loading token strings alone is insufficient.
- Health dates use `GARMIN_TIME_ZONE` (default `Asia/Shanghai`), never UTC
  `date()` as a local-day substitute.
- Normalize every candidate before source precedence. A valid daily-summary value
  outranks its domain fallback; an invalid primary behaves as missing and must not
  overwrite a valid fallback. Numeric zero remains a valid observation.
- `daily_summary` is primary for steps, target, resting heart rate, intensity
  minutes, stress, and current body battery. Body-battery series provide the
  latest valid fallback value.
- Public JSON allowlists calendar/freshness, six display metrics, and server
  evaluation. It never returns `summaryData`, account identifiers, raw payloads,
  locations, or credentials.
- Step goal resolution is system `landingStepGoal` → Garmin goal → 8,000.
- Evaluation weights are sleep 25, body battery 25, inverse stress 20,
  time-adjusted steps 15, and time-adjusted intensity 15. Before 08:00 progress
  dimensions are ineligible; after 22:00 full-day targets apply.
- Missing dimensions are omitted and remaining weights re-normalized. Fewer than
  three dimensions or less than 50% eligible weight produces a null evaluation.
- Sleep uses a real Garmin score when present, duration fallback otherwise, and
  never fabricates a Garmin score.
- Landing reserves the section for loading, collecting, partial, stale (>6h),
  and error states. Yesterday's row is never shown as today. The dependency-free
  CSS 3D character consumes only the status union, has no pointer interaction,
  and becomes static under reduced-motion preference.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Candidate is missing, null, non-numeric, NaN, or infinite | Treat it as missing and try the lower-priority source |
| Steps, goal, heart rate, intensity, or sleep duration is negative | Reject it and preserve a valid fallback |
| Stress, Body Battery, or sleep score is outside 0–100 | Reject it and preserve a valid fallback |
| Candidate is numeric zero | Preserve it; do not replace it with fallback data |
| Fewer than three eligible dimensions or less than 50% eligible weight | Return a null evaluation with collecting semantics |
| Snapshot date differs from Garmin-local today | Return null; never present yesterday as today |
| Snapshot age exceeds six hours | Preserve today's values and set `stale: true` |
| Saved `landingStepGoal` is invalid | Treat it as unset and use Garmin goal, then 8,000 |

### 5. Good / Base / Bad Cases

- Good: valid daily summary supplies all six metrics and produces one stable
  four-level evaluation for an injected evaluation time.
- Base: sleep score is absent but real duration is available; duration is shown
  and scored while other missing dimensions are re-normalized.
- Bad: storing `-1`, `Infinity`, or `101` as a preferred metric; converting a
  missing dimension to zero; exposing raw `summaryData`; or showing yesterday's
  snapshot as today.

### 6. Tests Required

- Worker tests assert standard token login initializes profile, Garmin-local
  today/yesterday selection, intensity aliases, valid-zero retention, invalid
  primary fallback, and latest valid Body Battery selection.
- Backend tests assert goal precedence, score thresholds, time progress,
  confidence, same-day/stale behavior, null/error handling, and the public
  allowlist's privacy boundary.
- Frontend tests assert null versus zero formatting and sleep discrimination;
  responsive browser checks cover desktop, 800px, and 390px without horizontal
  overflow, plus reduced-motion/static CSS fallbacks.

### 7. Wrong vs Correct

```python
# Wrong: source precedence runs before validation, so an invalid primary wins.
summary["bodyBattery"] = daily_summary.get("bodyBatteryMostRecentValue")

# Correct: normalize each candidate first; only a valid primary can replace the
# already-normalized domain fallback.
primary = _health_metric_number(
    "bodyBattery", daily_summary.get("bodyBatteryMostRecentValue")
)
if primary is not None:
    summary["bodyBattery"] = primary
```

## Scenario: Public Landing Garmin stats

### 1. Scope / Trigger

- Trigger: worker → MySQL → NestJS → Vue Landing; schema and DTO fields for calories / location / route previews / card-safe detail metrics.
- Applies when changing `workers/garmin-sync/`, `GarminActivitySnapshot`, `GET /garmin/stats`, `@applog/common` Garmin types, or `LandingGarminStats`.

### 2. Signatures

- Public API: `GET /garmin/stats` → `IGarminLandingStats | null` (never triggers Garmin upstream).
- DB table: `garmin_activity_snapshot` (camelCase columns, aligned with TypeORM + worker SQL).
- Worker: list normalize → optional GPS route SVG for route activity types → bounded private-detail parse → upsert + reconcile.

### 3. Contracts

**`IGarminLandingActivity`**

| Field | Type | Constraints |
|-------|------|-------------|
| `type` | string | Normalized Garmin `typeKey` (casefold) |
| `typeDisplay` | string | Chinese from worker `TYPE_LABELS`, else underscore→space fallback |
| `date` | string | ISO datetime from `startedAt` |
| `distanceMeters` | number \| null | Finite ≥ 0; invalid → null |
| `durationSeconds` | number | Required, rounded non-negative |
| `calories` | number \| null | Finite ≥ 0 integer; invalid → null |
| `locationName` | string \| null | Display string ≤ 64; reject coordinate-like; never lat/lon columns |
| `deviceSource` | string \| null | Optional device model |
| `route` | `{ pathData, viewBox } \| null` | Coordinate-free `M/L` SVG only |
| `metrics` | `IGarminLandingActivityMetrics` | Seven finite-number-or-null card fields projected from normalized `detailData`; never contains splits or raw payload |

**`IGarminLandingActivityMetrics`**: `averagePaceSecondsPerKm`,
`averageHeartRateBpm`, `maxHeartRateBpm`, `averageCadencePerMinute`,
`averagePowerWatts`, `trainingEffect`, and `steps`. NestJS owns the `unknown` →
finite number/null boundary. Old snapshots without `detailData` return all-null metrics.

**`IGarminLandingStats`**: `totalActivityCount`, `activities` (newest 6, `published`), `fetchedAt`, `stale` (>6h or non-healthy sync).

**Forbidden in public JSON / DB columns**: `sourceActivityId`, raw lat/lon, GPX/FIT, tokens, account ids.

**Landing presentation**

- Horizontal scroll; edge fades only when overflow can scroll.
- Route cards: generated WebP first. Regular GPS activities use a Tencent route map;
  `soccer` uses GPS density over the same real basemap; a single activity or
  weather coordinate uses a mapped marker. Without any usable coordinate, use
  the explicit no-map cover and never fabricate a track, marker, or heatmap.
  A card is interactive only when its public SVG route passes frontend M/L path
  validation; a generated cover or `publicId` alone does not make it interactive.
- No-route cards: render no WebP, SVG, `ActivityTypeCover`, point map, or other
  cover. Render a non-interactive `article` with title/date plus at most five
  non-null type-preset metrics. It must not expose a detail aria-label or respond
  to click/Enter/Space. Keep the title/date at the top and bottom-align the metric
  grid without a divider between them.
- Route card metrics use small icons: time, location?, distance?, calories?,
  duration. Distance (when present) is a bottom-right cover tag. Generated map
  attribution is baked into the image, so the frontend must not overlay it again.
- `indoor_cycling` card priority: duration, calories, average heart rate,
  average power, cadence; label cycling cadence「踏频」rather than「步频」.
- Pointer-fine cards retain bounded perspective rotation but must not scale;
  touch and reduced-motion environments remain static.
- Opening and closing activity details uses the Dialog's native transition only;
  do not clone, move, or scale the card cover as a shared element.
- At viewport widths up to 800px, route cards are static articles rather than
  buttons and the activity detail Dialog cannot be opened.
- No per-card device source line (`Garmin · …`).
- Elliptical (`elliptical`) never shows distance even if upstream provides meters.
- The detail Dialog is teleported. Width/max-width overrides must be expressed
  as important classes on `DialogContent`; scoped `:deep()` width rules alone do
  not reliably beat the primitive's `w-full sm:max-w-sm` classes after teleport.

### 4. Validation & Error Matrix

| Condition | Behavior |
|-----------|----------|
| Privacy not `public` / `everyone` | Worker drops activity |
| Missing id / type / start / duration | Worker drops activity |
| Calories invalid / negative | Persist `null` |
| Location empty or coordinate-like | Persist `null` |
| Route points degenerate | `route` null; metadata may still publish |
| `detailData` metric missing, non-number, or non-finite | Public `metrics` field is `null`; card omits it |
| Valid `publicId` but no validated route | Static data card; detail endpoint is not opened |
| Viewport ≤800px | Route cards are non-interactive and no detail Dialog is rendered |
| Never synced / DB error | Nest returns `null` or `BusinessException` soft message |
| Sync degraded / >6h | Return last snapshot with `stale: true` |

### 5. Good / Base / Bad Cases

- Good: public cycling with a validated route → route button, GPS cover, detail Dialog.
- Base: indoor cycling without route → static data card with available heart-rate/power/cadence metrics; null metrics omitted.
- Bad: private activity, or location `"31.2, 121.5"` → not published / location null.

### 6. Tests Required

- Worker: TYPE_LABELS for elliptical / track_running / soccer / cycling / indoor
  cycling; soccer and indoor cycling are included in bounded archived-detail
  reparsing so newly exposed Landing metrics can be backfilled.
- Backend: public DTO projects only the seven card metric fields; JSON must not
  contain splits, raw payload, `latitude` / `longitude` / `sourceActivityId`.
- Frontend utils: `formatDistance` / `formatCalories` return null when absent;
  route endpoint safety; indoor cycling preset returns at most five non-null
  metrics and labels cadence「踏频」.
- Frontend visual: 1440×900, 1024×768, 768×1024, and 390×844 have no horizontal
  Dialog overflow; 768/390 use a single column and keep the close button visible.

### 7. Wrong vs Correct

#### Wrong
```ts
// Treat every public activity as interactive or leak all detailData into stats
return { ...activity, metrics: activity.detailData }
```

#### Correct
```ts
return {
  type, typeDisplay, date, distanceMeters, durationSeconds,
  calories, locationName, deviceSource,
  route: pathData && viewBox ? { pathData, viewBox } : null,
  metrics: pickFiniteCardMetrics(detailData),
}
```

```python
# Location evidence and weather provenance stay inside the worker.
evidence = resolve_location_evidence(
    points,
    activity_point=activity_point,
    weather_payload=private_weather_payload,
)
cover = render_activity_cover(activity_type, evidence)
```

## Boundaries

- Only the Python worker decrypts Garmin tokens and calls Garmin Connect.
- NestJS serves whitelist snapshots only.
- `TYPE_LABELS` in worker is the authority for Chinese activity names (upsert refreshes display labels).

## Retired scenario: Self-contained Garmin map renderer image

This scenario is retained only as historical design context. The Martin/PMTiles
renderer, release assets, deployment unit, and configuration were removed after
the Tencent validation passed; none of the requirements below apply to current
production deployments.

### 1. Scope / Trigger

- Trigger: changes to `workers/garmin-sync/maps/Dockerfile`, its build scripts,
  renderer container config, baked release, manifest export, or Docker deployment.
- This is AppLog-only infrastructure for Garmin covers, not a general map service.

### 2. Signatures

- Build: `docker build -f workers/garmin-sync/maps/Dockerfile .` with
  `BUILD_MODE=fixture|production`.
- Production inputs: explicit `PROTOMAPS_BUILD_DATE`, HTTPS build URL, official
  BLAKE3 provenance, release id, source revision, and digest-qualified
  PMTiles/Node/Go/Martin image references.
- Runtime: container Martin listens on `0.0.0.0:3000`; publish to host loopback
  for same-host workers or to an explicit firewall-restricted private address
  for remote workers. There is no runtime map volume.
- Worker manifest: `/opt/applog/maps/current/manifest.json`, exported from the
  exact running image digest.

### 3. Contracts

- The final OCI image bakes `basemap.pmtiles`, `style.json`, Noto fonts,
  `manifest.json`, NOTICE and font licenses under `/opt/applog/maps/current`.
- Runtime is non-root, read-only-root compatible, capability-free, on an
  egress-disabled Docker network, and exposes only the Martin contract needed
  by `LocalMapRenderer`.
- Production builds use no floating image tags as trust boundaries. All four
  base/tool images must be `name@sha256:...`; Martin's native binary hash and
  OCI digest are recorded separately in the release manifest.
- Builds may use the network. Runtime style/tile/glyph resolution is loopback
  only and must continue to work with outbound traffic denied.
- Production builds HTTP Range-extract global z0-6 and Greater Bay Area z7-15
  directly from the explicit build URL; they must not materialize the complete
  planet archive. The official BLAKE3 is validated for presence/format and
  recorded as upstream provenance, not claimed as locally reverified. Local
  gates remain merged-output `pmtiles verify` and release asset SHA-256 checks.
- A release switch is one operational transaction: disable Garmin timer, stage
  the target image's manifest, replace and health-check renderer, atomically
  rename the staged manifest, then re-enable the timer. Keep the old image and
  manifest until one bounded sync succeeds.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| Production base image is tag-only or digest malformed | Fail the image build |
| Protomaps date/URL/BLAKE3 provenance absent, placeholder, or malformed | Fail before extracting the release |
| HTTP Range extraction, merge, final PMTiles verify, or asset SHA-256 fails | Fail before final image creation |
| PMTiles invalid, font/license absent, asset hash wrong, or style has public URL | Fail before final image creation |
| Container health fails after image replacement | Keep timer disabled; restore prior image/manifest |
| Manifest is from a different image digest | Do not run sync or publish the manifest |
| Remote host port is public or reachable by unapproved clients | Reject the deployment configuration; bind a private address and allowlist worker hosts |

### 5. Good / Base / Bad Cases

- Good: production image is built from explicit hashes, runs without volumes or
  egress, passes the 100-image prototype, then switches with its matching manifest.
- Base: the checked-in Victoria Park fixture image exercises the identical
  runtime and release verification path without downloading production coverage.
- Bad: mounting `/opt/applog/maps`, using `latest`, exposing port 3000 publicly,
  or overwriting live manifest before the new renderer is healthy.

### 6. Tests Required

- Fast tests assert version/digest gates, baked paths, non-root healthcheck,
  internal Compose network, secret-excluding Docker build context and config URLs.
- Linux Docker integration builds fixture mode, starts with read-only root,
  dropped capabilities and an internal network, exports the baked manifest, and
  runs `map_prototype --fixture-profile victoria-park --iterations 100`.
- Production release validation separately builds real coverage, scans image
  history/config for secrets, deploys by digest, performs one bounded sync, and
  proves rollback to the previous image plus manifest.

### 7. Wrong vs Correct

#### Wrong

```bash
docker run -p 3000:3000 -v /opt/maps:/opt/applog/maps martin:latest
cp new-manifest.json /opt/applog/maps/current/manifest.json
```

#### Correct

```bash
manage-timer disable
docker run --network applog-map-internal -p 127.0.0.1:3000:3000 \
  registry.example/applog-map-renderer@sha256:IMAGE_DIGEST
curl --fail http://127.0.0.1:3000/health
mv /opt/applog/maps/current/.manifest.json.next \
  /opt/applog/maps/current/manifest.json
manage-timer enable
```

## Verification

Worker unittest (`test_normalize` / `test_sync`), `packages/backend/test/garmin.service.spec.ts`, `packages/frontend/test/garmin-utils.spec.mjs`, `@applog/common` build, frontend type-check on touched files.

## Scenario: Private archive, public detail, and generated covers

### 1. Scope / Trigger

- Trigger: changes to private Garmin activity/health storage, stream cursors,
  encrypted payloads, generated cover media, public activity details, or cover
  authorization.
- Applies across the Python worker, MySQL/TypeORM schema, NestJS Garmin module,
  `@applog/common`, and Landing Garmin components.

### 2. Signatures

- APIs:
  - `GET /garmin/stats` → newest six published summaries whose `publicId` is non-null.
  - `GET /garmin/activities/:publicId` → `IGarminLandingActivityDetail` for a
    currently published projection row.
  - `GET /garmin/covers/:coverId.webp` → immutable `image/webp` only while a
    currently published projection row references that cover.
- Private tables: `garmin_private_activity`, `garmin_private_payload`,
  `garmin_activity_detail`, `garmin_health_daily`, `garmin_sync_stream_state`,
  and `garmin_activity_cover`.
- Public table: `garmin_activity_snapshot` remains the only Landing read model.

### 3. Contracts

- `GARMIN_DATA_ENCRYPTION_KEY` is a separate Base64-encoded 32-byte AES-256-GCM
  key; it must not reuse the token key.
- Worker MySQL configuration prefers `GARMIN_MYSQL_*` and falls back to the
  matching `MYSQL_*` keys used by NestJS/FC.
- Cover configuration uses `GARMIN_MAP_COVERS_ENABLED`, `TENCENT_MAP_KEY`, and
  `GARMIN_MAP_RENDER_TIMEOUT_SECONDS`. The Key is server-side only and must not
  appear in logs, stored cover metadata, or a render fingerprint.
- Location evidence is private and has exactly three forms: `route` (two or more
  distinct valid Garmin points), `point` (activity coordinate, then archived
  weather coordinate), or `none`. Weather provenance means “activity-nearby
  location,” not GPS track data, and is never persisted in the public projection.
- Every overlay and basemap uses one continuous Web Mercator camera. A 480×480
  cover keeps a 16px target safety margin, renders at 960×960, then downsamples.
  Draw the fixed-pixel route/marker/heat field after the camera is final; never
  crop or magnify a rendered overlay to create padding.
- Activity-list pages are durably indexed before their list cursor advances.
- `garmin_sync_stream_state.cursor` is a MySQL 5.7 reserved identifier. Every
  Python SQL reference must use `` `cursor` `` in `SELECT`, `INSERT`, update
  targets, and `VALUES()` expressions; TypeORM decorator quoting does not protect
  the worker's handwritten SQL.
- Health summary columns normalize only explicit observed fields: numeric zero is
  retained, missing/explicit null are not coerced, and local/GMT boundaries are
  stored only when upstream supplies timestamps. Historical health backfill finds
  the available-history boundary through consecutive measurement-empty dates,
  never through a fixed-year cutoff.
  Bounded detail work is selected from the persistent `pending`/`failed` queue,
  never only from an in-memory prefix of the current page.
- Payload AAD binds domain, owner, payload kind, and encryption version. JSON is
  canonicalized and gzipped before encryption; FIT remains binary and is hash
  verified after decryption.
- Public responses are rebuilt from explicit allowlists. They never expose source
  activity ids, raw coordinates, raw `detailData`, FIT, health payloads, private
  visibility, encryption metadata, or private media ownership.
- Cover quality is activity-aware and monotonic: mapped heatmap/route/point
  outranks its local fallback or no-map state. A transient renderer failure or
  missing route must not replace an existing mapped cover. A soccer heatmap is
  current only while the activity remains soccer with valid samples.
  A lower-quality retry must not overwrite a higher-quality existing cover.
- Cover URLs are content-immutable: identical ETags skip writes; changed bytes
  receive a fresh random `coverId`, and the media row plus any existing snapshot
  reference are updated in one transaction before the new URL is returned.
- If identical bytes are regenerated under a new provider or `renderVersion`, keep
  the existing `coverId` and bytes but refresh that currentness metadata; otherwise
  the route stays permanently stale and consumes the route budget every invocation.
- A cover counts as current only when its composite `renderVersion` matches the
  code overlay and Tencent static-map projection versions. Current providers are
  `tencent-route`, `tencent-point`, `tencent-heatmap`, and `no-map` for genuinely
  coordinate-free evidence. Historical `protomaps-*` values are migration-only.
  `local-route`, `local-point`, and `fallback-no-map` remain retryable. A renderer
  or release change requeues bounded route-point loading for the newest public
  candidates rather than treating a historical cover as final.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| Request budget exhausted, authentication failure, or rate limit | Treat as fatal stream control; do not swallow it as a conditional endpoint failure or advance the affected cursor |
| Conditional detail endpoint unavailable | Preserve successful payload kinds and mark the activity `partial` |
| FIT exceeds the configured cap | Record partial status; do not fail unrelated activities or streams |
| Required health domain fails for a historical date | Record `failed`; do not advance that date cursor |
| Renderer down / timeout / bad HTTP / invalid WebP | Preserve the last mapped cover; for a first cover create a typed local fallback without failing data sync |
| Activity outside Tencent's mainland envelope | Return `region_missing` before HTTP |
| Soccer has fewer than two distinct valid GPS samples | Do not create a heatmap; use a valid point map or explicit no-map cover |
| Tencent Key is absent or invalid | Keep fallback covers retryable without exposing configuration |
| Activity becomes private/unpublished | Remove it from public projection; private history remains; detail and old cover URLs become unreadable |
| Snapshot has migration-window null `publicId` | Omit it from public stats until a random public id exists |
| Ciphertext, AAD, key, or content hash is wrong | Decryption fails closed; never return or normalize the payload |

### 5. Good / Base / Bad Cases

- Good: a public outdoor activity is privately archived, normalized, assigned a
  random `publicId`, rendered once as a Tencent route WebP with a 16px safety
  area, and served through summary, detail, and authorized cover endpoints.
- Good: public soccer with real GPS samples renders a deterministic density heat
  layer aligned over the same Tencent camera without exposing the route.
- Base: an indoor activity with an archived Garmin weather coordinate gets a
  mapped marker whose `weather` provenance remains ephemeral and private.
- Base: an indoor activity without a point, or a renderer outage, keeps the
  activity available with an explicit no-map/local fallback; later retries may
  improve but never downgrade cover quality.
- Bad: advancing a history cursor after indexing only the first detail candidates,
  fabricating a soccer heatmap without GPS samples, returning a cover because its
  random id exists without checking publication, or logging Garmin
  ids/dates/coordinates/health values.

### 6. Tests Required

- Worker: canonical JSON/FIT codec round-trip, wrong key/AAD/tamper/hash failure,
  size-cap partial handling, whole-page indexing, persistent detail queue, budget
  exhaustion, MySQL-safe quoting for every stream cursor read/write, health cursor
  non-advancement, cover monotonicity, immutable cover-ID rotation, and
  metadata-free deterministic WebP dimensions; route dominant-axis occupancy and
  16px safety bounds; point/weather/none evidence priority; antimeridian camera;
  renderer status/content-type/dimension/blank/coverage failures; soccer basemap
  heat-density determinism and camera alignment; soccer-vs-route selection; and
  soccer-to-non-soccer cover replacement after an activity-type correction.
- Map release: fixture SHA-256 and ODbL metadata; style contains no non-loopback
  URL; local font exists; every asset path remains inside the release; PMTiles
  and pinned Martin binary hashes verify before atomic activation.
- Backend: public stats exclude null ids; detail and cover require `published`;
  public JSON omits forbidden private fields; cover response has WebP content type,
  ETag, and immutable caching.
- Frontend: all eight metric presets, null omission/valid-zero retention, lazy
  request race handling, retry, tilt cleanup, keyboard/Escape/focus return,
  reduced motion, and shared-element cancellation cleanup.

### 7. Wrong vs Correct

#### Wrong

```python
# The page cursor now skips every activity after the bounded in-memory prefix.
for item in page[:detail_budget]:
    fetch_details(item)
advance_list_cursor(next_page)
```

```ts
// A random id is discoverability resistance, not publication authorization.
return coverRepository.findOneBy({ coverId })
```

#### Correct

```python
index_entire_page(page)
advance_list_cursor(next_page)
process_persistent_detail_queue(detail_budget)
```

```ts
const snapshot = await snapshotRepository.findOne({
  where: { coverId, published: true },
})
if (!snapshot) throw new BusinessException('活动封面不存在')
```

## Scenario: Indoor activity detail normalization

### 1. Scope / Trigger

- Trigger: Garmin activity `summary`/split payload shapes, normalized detail
  fields, parser-version backfill, or indoor metric presentation changes.

### 2. Signatures

- Worker input: `summary.summaryDTO`, optional `metadataDTO`, `splits.lapDTOs`,
  `typed_splits.splits`, and `split_summaries.splitSummaries`.
- DB: `garmin_activity_detail` nullable metrics plus
  `garmin_private_activity.detailParserVersion`.
- Public detail adds nullable `anaerobicTrainingEffect`,
  `activityTrainingLoad`, and `steps`.

### 3. Contracts

- `summaryDTO` is the current primary metric source. A top-level summary is a
  compatibility fallback only; it must never overwrite an explicit nested zero
  or null.
- Split priority is exactly `lapDTOs` → typed splits → split summaries. Use one
  source only and expose at most 12 allowlisted rows.
- Missing source metrics stay null. Preserve numeric zero. Do not infer heart
  rate, power, cadence, steps, or training effects from another metric.
- A parser-version upgrade first authenticates and reparses archived summary and
  splits without a Garmin request. Missing summary or AEAD authentication failure
  enters the existing bounded remote detail queue.
- Parser-version migration is limited to treadmill, elliptical, indoor cardio,
  and stair-climbing activities. Pending/failed detail work for other types keeps
  the normal queue behavior.
- Public responses continue to rebuild an explicit allowlist. Raw payloads,
  samples, FIT, private ids, coordinates, timestamps, and encryption metadata
  never cross the worker boundary.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| `summaryDTO` is present | Normalize it instead of reading metric keys from the envelope |
| Metric is absent, null, non-numeric, NaN, or infinite | Persist and publish null |
| Metric is valid zero | Preserve zero and allow the UI to display it |
| Multiple split domains exist | Select the highest-priority non-empty domain; do not merge |
| Archived payload fails AEAD/hash/decode | Fail closed and remotely refetch that activity within the detail budget |
| Archived summary is absent | Remotely refetch within the detail budget |
| Conditional Garmin domain fails | Preserve successful domains and keep detail status partial/retryable |

### 5. Good / Base / Bad Cases

- Good: a treadmill `summaryDTO` yields heart rate, cadence, power, aerobic and
  anaerobic effects, training load, Body Battery delta, steps, and lap splits.
- Base: indoor cardio lacks power/cadence; those fields remain null while common
  heart-rate and training fields publish normally.
- Bad: reading only top-level `averageHR`, converting missing steps to zero,
  merging lapDTOs with typed splits, or bypassing `InvalidTag` authentication.

### 6. Tests Required

- Worker synthetic fixtures for treadmill, elliptical, indoor cardio, and stair
  climbing; nested precedence, valid zero, invalid numeric values, every mapped
  metric, split priority, and the 12-row cap.
- Sync tests prove local reparse makes no Garmin call and unreadable archive data
  falls back to one bounded remote refetch.
- Backend tests assert the three new fields pass the allowlist while private
  fields remain absent; frontend tests assert null omission and zero retention.
- A read-only production dry-run reports only type-level candidate/field counts,
  never activity identifiers or values.

### 7. Wrong vs Correct

#### Wrong

```python
source = summary
heart_rate = source.get("averageHR")  # current payload stores summaryDTO.averageHR
```

#### Correct

```python
nested = summary.get("summaryDTO")
source = nested if isinstance(nested, dict) else summary
heart_rate = _metric(source, "averageHR", "averageHeartRate")
```

## Scenario: Tencent static basemap provider

### 1. Scope / Trigger

- Trigger: changes to the Garmin worker's online basemap provider, Tencent Key,
  coordinate conversion, provider currentness, static-map response handling, or
  removal of the Martin/PMTiles production dependency.
- Tencent is a mainland-only lightweight alternative. It supplies the raster;
  AppLog continues to own every route, marker and heatmap overlay.

### 2. Signatures

- Environment: `TENCENT_MAP_KEY` and optional
  `GARMIN_MAP_RENDER_TIMEOUT_SECONDS` (positive float, default `8`).
- Request: `GET https://apis.map.qq.com/ws/staticmap/v2/` with only `center`,
  integer `zoom`, `size=480*480`, `scale=2`, `maptype=roadmap`, and `key`.
- Result: `RenderedBasemap(image, camera, points)` carries the exact GCJ-02
  camera and converted points that local Pillow overlays must project against.
- Current providers: `tencent-route`, `tencent-point`, and `tencent-heatmap`;
  their render fingerprint includes `static-v2-gcj02-v1`, never the Key.

### 3. Contracts

- Garmin geometry stays WGS-84 until the renderer boundary. Convert the camera
  center and every overlay point with the same `wgs84_to_gcj02` implementation.
- Tencent static zoom is an integer in 4–17 on a 256px tile pyramid, while
  `MapCamera` uses 512px tiles. Request `floor(camera.zoom) + 1`, then project
  overlays with `requested_zoom - 1`; never use the same numeric zoom for both.
- Never send `path`, `markers`, an activity ID, or a complete trace to Tencent.
  Never log the Key, complete request URL, center, or coordinates.
- Keep the Key only in the worker's server-side secret environment and enable
  only WebService plus the narrowest available server restriction.
- Accept only decodable 960×960 PNG/JPEG within the raster byte cap. Parse
  `X-LIMIT` only into bounded numeric QPS/PV telemetry.
- Persist final AppLog covers and retain monotonic cover replacement. Do not add
  a raw Tencent basemap cache without a separate current-terms review.
- Martin/PMTiles is not a runtime fallback. Failures preserve a successful
  existing cover or use the typed local fallback.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| Missing/whitespace Key or invalid timeout | Treat renderer as unconfigured/unhealthy without exposing config |
| Point outside Tencent's documented domestic envelope | `region_missing` before HTTP; do not call a second provider |
| HTTP timeout / transport failure | `renderer_timeout` / `renderer_unhealthy` |
| HTTP 200 JSON status 120 or 121 | `quota_exhausted` |
| JSON authentication/authorization status 110–113, 160–161, 190 or 199 | `asset_missing` |
| JSON parameter status 3xx/4xx | `region_missing` |
| Wrong content type, dimensions, blank image, decode failure or oversize body | `invalid_raster` |
| Any Tencent failure with an existing mapped cover | Preserve the existing cover; do not downgrade |

### 5. Good / Base / Bad Cases

- Good: a mainland route requests one clean 960×960 roadmap using only its
  transformed camera, then draws the 6px red route and endpoint arrows locally
  within the 16px target safety area.
- Base: an overseas route returns `region_missing` before HTTP and keeps or
  creates the typed fallback cover.
- Bad: sending `path=<private trace>`, drawing WGS-84 points over a GCJ-02 map,
  treating Tencent/MapCamera zooms as equal, or logging a request URL.

### 6. Tests Required

- Known mainland WGS-84→GCJ-02 control point and overseas rejection.
- Outgoing query has exactly `center`, `zoom`, `size`, `scale`, `maptype`, `key`;
  assert no path, marker, activity identifier or trace appears.
- Tencent `RenderedBasemap` drives the local route/point/heatmap camera and
  provider metadata; repository currentness selects the configured provider.
- PNG/JPEG size/content/blank/byte validation; timeout, HTTP and documented JSON
  status mapping; `X-LIMIT` JSON/key-value parsing; logs exclude Key/coordinates.
- Real public/synthetic fixtures at zoom 12/15/17 must prove ≤2 final-pixel
  overlay alignment and pass a human A/B review before Tencent becomes default.

### 7. Wrong vs Correct

#### Wrong

```python
url = f"{endpoint}?path={private_trace}&key={key}"
basemap = fetch(url)
draw_route(basemap, wgs84_camera, wgs84_points)
```

#### Correct

```python
basemap = renderer.render(camera, private_points)  # request sends camera only
draw_route(basemap.image, basemap.camera, list(basemap.points))
```
