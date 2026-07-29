# Garmin Landing Activity Snapshot Contract

> Cross-layer contract for the systemd Python worker, public NestJS snapshot API, and Landing activity cards.

## Scenario: Public Landing Garmin stats

### 1. Scope / Trigger

- Trigger: worker → MySQL → NestJS → Vue Landing; schema and DTO fields for calories / location / route previews.
- Applies when changing `workers/garmin-sync/`, `GarminActivitySnapshot`, `GET /garmin/stats`, `@applog/common` Garmin types, or `LandingGarminStats`.

### 2. Signatures

- Public API: `GET /garmin/stats` → `IGarminLandingStats | null` (never triggers Garmin upstream).
- DB table: `garmin_activity_snapshot` (camelCase columns, aligned with TypeORM + worker SQL).
- Worker: list normalize → optional GPS route SVG for running-class types → upsert + reconcile.

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

**`IGarminLandingStats`**: `totalActivityCount`, `activities` (newest 6, `published`), `fetchedAt`, `stale` (>6h or non-healthy sync).

**Forbidden in public JSON / DB columns**: `sourceActivityId`, raw lat/lon, GPX/FIT, tokens, account ids.

**Landing presentation**

- Horizontal scroll; edge fades only when overflow can scroll.
- Cover: generated WebP first. Regular GPS activities use a Protomaps route map;
  `soccer` uses GPS density over the same real basemap; a single activity or
  weather coordinate uses a mapped marker. Without any usable coordinate, use
  the explicit no-map cover and never fabricate a track, marker, or heatmap. The
  public SVG route / `ActivityTypeCover` remain migration fallbacks when no
  generated cover is available.
- Metrics with small icons: time, location?, distance?, calories?, duration. Omit null optionals (no「距离暂无」).
- Compact square-cover cards; distance (when present) is a bottom-left cover tag, not a body metric.
- Body is always 3 rows: title · time(+location) · calories/duration packed on one line.
- No per-card device source line (`Garmin · …`).
- Elliptical (`elliptical`) never shows distance even if upstream provides meters.

### 4. Validation & Error Matrix

| Condition | Behavior |
|-----------|----------|
| Privacy not `public` / `everyone` | Worker drops activity |
| Missing id / type / start / duration | Worker drops activity |
| Calories invalid / negative | Persist `null` |
| Location empty or coordinate-like | Persist `null` |
| Route points degenerate | `route` null; metadata may still publish |
| Never synced / DB error | Nest returns `null` or `BusinessException` soft message |
| Sync degraded / >6h | Return last snapshot with `stale: true` |

### 5. Good / Base / Bad Cases

- Good: public running with route + calories + city name → GPS cover, full metrics.
- Base: elliptical / soccer, no route → coordinate-free cover; omit distance/location if null.
- Bad: private activity, or location `"31.2, 121.5"` → not published / location null.

### 6. Tests Required

- Worker: TYPE_LABELS for elliptical / track_running / soccer; calories/location accept/reject.
- Backend: public DTO includes new fields; JSON must not contain `latitude` / `longitude` / `sourceActivityId`.
- Frontend utils: `formatDistance` / `formatCalories` return null when absent; route endpoint safety.

### 7. Wrong vs Correct

#### Wrong
```ts
// Expose start coordinates or fake soccer heatmap from missing GPS samples
return { ...activity, startLat, startLon, heatmap: fabricateGrid() }
```

#### Correct
```ts
return {
  type, typeDisplay, date, distanceMeters, durationSeconds,
  calories, locationName, deviceSource,
  route: pathData && viewBox ? { pathData, viewBox } : null,
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

## Scenario: Self-contained Garmin map renderer image

### 1. Scope / Trigger

- Trigger: changes to `workers/garmin-sync/maps/Dockerfile`, its build scripts,
  renderer container config, baked release, manifest export, or Docker deployment.
- This is AppLog-only infrastructure for Garmin covers, not a general map service.

### 2. Signatures

- Build: `docker build -f workers/garmin-sync/maps/Dockerfile .` with
  `BUILD_MODE=fixture|production`.
- Production inputs: explicit `PROTOMAPS_BUILD_DATE`, HTTPS build URL, official
  BLAKE3, release id, source revision, and digest-qualified PMTiles/Node/Go/Martin
  image references.
- Runtime: host `127.0.0.1:3000` → container Martin `0.0.0.0:3000`;
  no runtime map volume.
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
- A release switch is one operational transaction: disable Garmin timer, stage
  the target image's manifest, replace and health-check renderer, atomically
  rename the staged manifest, then re-enable the timer. Keep the old image and
  manifest until one bounded sync succeeds.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| Production base image is tag-only or digest malformed | Fail the image build |
| Protomaps date/URL/BLAKE3 absent, placeholder, or mismatched | Fail before extracting the release |
| PMTiles invalid, font/license absent, asset hash wrong, or style has public URL | Fail before final image creation |
| Container health fails after image replacement | Keep timer disabled; restore prior image/manifest |
| Manifest is from a different image digest | Do not run sync or publish the manifest |
| Host port would bind non-loopback or Docker network allows egress | Reject the deployment configuration |

### 5. Good / Base / Bad Cases

- Good: production image is built from explicit hashes, runs without volumes or
  egress, passes the 100-image prototype, then switches with its matching manifest.
- Base: the checked-in Victoria Park fixture image exercises the identical
  runtime and release verification path without downloading production coverage.
- Bad: mounting `/opt/applog/maps`, using `latest`, publishing `0.0.0.0:3000`,
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
- Cover configuration uses `GARMIN_MAP_COVERS_ENABLED`,
  `GARMIN_MAP_RENDERER_URL`, `GARMIN_MAP_RELEASE_MANIFEST`, and
  `GARMIN_MAP_RENDER_TIMEOUT_SECONDS`. The renderer URL must be plain HTTP on
  loopback. The manifest supplies immutable release/style/renderer versions and
  explicit coverage regions. Remote tile URLs, provider tokens, CARTO settings,
  and runtime public font/sprite requests are forbidden.
- Location evidence is private and has exactly three forms: `route` (two or more
  distinct valid Garmin points), `point` (activity coordinate, then archived
  weather coordinate), or `none`. Weather provenance means “activity-nearby
  location,” not GPS track data, and is never persisted in the public projection.
- Every overlay and basemap uses one continuous Web Mercator camera. A 480×480
  cover keeps a 32px target safety margin, renders at 960×960, then downsamples.
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
  code overlay version plus PMTiles release, Protomaps style, and Martin version.
  Current providers are `protomaps-route`, `protomaps-point`,
  `protomaps-heatmap`, and `no-map` for genuinely coordinate-free evidence.
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
| Manifest/style/font/PMTiles missing or hash mismatch | Reject the release before activation; never raise the active render fingerprint |
| Activity outside a high-detail manifest region | Return `region_missing`; do not stretch global z0–6 into fake street detail |
| Soccer has fewer than two distinct valid GPS samples | Do not create a heatmap; use a valid point map or explicit no-map cover |
| Renderer URL is absent or non-loopback | Treat Protomaps rendering as unavailable and keep fallback covers retryable |
| Activity becomes private/unpublished | Remove it from public projection; private history remains; detail and old cover URLs become unreadable |
| Snapshot has migration-window null `publicId` | Omit it from public stats until a random public id exists |
| Ciphertext, AAD, key, or content hash is wrong | Decryption fails closed; never return or normalize the payload |

### 5. Good / Base / Bad Cases

- Good: a public outdoor activity is privately archived, normalized, assigned a
  random `publicId`, rendered once as a Protomaps route WebP with a 32px safety
  area, and served through summary, detail, and authorized cover endpoints.
- Good: public soccer with real GPS samples renders a deterministic density heat
  layer aligned over the same real Protomaps camera without exposing coordinates.
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
  32px safety bounds; point/weather/none evidence priority; antimeridian camera;
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
