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
- Cover: generated WebP first; regular GPS activities use a route map, while
  `soccer` with real GPS samples uses a local pitch heatmap derived from sample
  density. Without usable GPS samples, use the coordinate-free fallback and never
  fabricate a heatmap. The public SVG route / `ActivityTypeCover` remain migration
  fallbacks when no generated cover is available.
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
# Soccer cover generation stays private and receives only worker-side GPS points.
cover = render_soccer_heatmap_cover(points) if points else render_pin_cover()
```

## Boundaries

- Only the Python worker decrypts Garmin tokens and calls Garmin Connect.
- NestJS serves whitelist snapshots only.
- `TYPE_LABELS` in worker is the authority for Chinese activity names (upsert refreshes display labels).

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
- Cover configuration uses `GARMIN_MAP_COVERS_ENABLED`, `GARMIN_MAP_PROVIDER`,
  `GARMIN_MAP_TILE_URL`, `GARMIN_MAP_ATTRIBUTION`, and an identifiable
  `GARMIN_MAP_USER_AGENT`. `GARMIN_MAP_ROUTE_PADDING_PIXELS` controls the
  per-edge route margin in final cover pixels (default `28`); the renderer
  applies it at 2x before downsampling and crops the integer-zoom tile result to
  the requested visual margin. Provider, tile URL, and attribution
  remain deployment-controlled and have no production defaults in source. A
  remote provider is active only when all three values are present; partial
  configuration uses the local fallback and must not invalidate an otherwise
  current fallback cover on every invocation.
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
- Cover quality is monotonic: remote route map > local route fallback > pin.
  The GPS-derived `local-heatmap` is the intentional terminal cover for soccer,
  not a route-provider downgrade.
  A lower-quality retry must not overwrite a higher-quality existing cover.
- Cover URLs are content-immutable: identical ETags skip writes; changed bytes
  receive a fresh random `coverId`, and the media row plus any existing snapshot
  reference are updated in one transaction before the new URL is returned.
- If identical bytes are regenerated under a new provider or `renderVersion`, keep
  the existing `coverId` and bytes but refresh that currentness metadata; otherwise
  the route stays permanently stale and consumes the route budget every invocation.
- A route cover counts as current only when both `renderVersion` and the configured
  provider match. For `soccer`, only `local-heatmap` or the coordinate-free `local`
  fallback counts as current; a heatmap must never remain current after an upstream
  activity-type correction. GPS-derived heatmaps do not depend on the configured map
  tile provider. Renderer or provider changes must requeue route-point loading for
  the newest public candidates instead of treating any historical cover as final.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| Request budget exhausted, authentication failure, or rate limit | Treat as fatal stream control; do not swallow it as a conditional endpoint failure or advance the affected cursor |
| Conditional detail endpoint unavailable | Preserve successful payload kinds and mark the activity `partial` |
| FIT exceeds the configured cap | Record partial status; do not fail unrelated activities or streams |
| Required health domain fails for a historical date | Record `failed`; do not advance that date cursor |
| Map provider/rendering fails | Preserve the last good cover; otherwise use the coordinate-free fallback without failing data sync |
| Soccer has fewer than two distinct valid GPS samples | Do not create a heatmap; use the coordinate-free fallback |
| Provider name, tile URL, or attribution is missing | Treat remote maps as disabled, render locally, and compare currentness without a preferred remote provider |
| Activity becomes private/unpublished | Remove it from public projection; private history remains; detail and old cover URLs become unreadable |
| Snapshot has migration-window null `publicId` | Omit it from public stats until a random public id exists |
| Ciphertext, AAD, key, or content hash is wrong | Decryption fails closed; never return or normalize the payload |

### 5. Good / Base / Bad Cases

- Good: a public outdoor activity is privately archived, normalized, assigned a
  random `publicId`, rendered once as a route WebP, and served through summary,
  detail, and authorized cover endpoints.
- Good: public soccer with real GPS samples renders a deterministic pitch heatmap
  from sample density without persisting or exposing coordinates.
- Base: an indoor activity or provider outage keeps the activity available with a
  local pin/route fallback; later retries may improve but never downgrade cover quality.
- Bad: advancing a history cursor after indexing only the first detail candidates,
  fabricating a soccer heatmap without GPS samples, returning a cover because its
  random id exists without checking publication, or logging Garmin
  ids/dates/coordinates/health values.

### 6. Tests Required

- Worker: canonical JSON/FIT codec round-trip, wrong key/AAD/tamper/hash failure,
  size-cap partial handling, whole-page indexing, persistent detail queue, budget
  exhaustion, MySQL-safe quoting for every stream cursor read/write, health cursor
  non-advancement, cover monotonicity, immutable cover-ID rotation, and
  metadata-free deterministic WebP dimensions, route cover visual occupancy, soccer
  GPS-density heatmap determinism, soccer-vs-route renderer selection, and
  soccer-to-non-soccer cover replacement after an activity-type correction.
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
