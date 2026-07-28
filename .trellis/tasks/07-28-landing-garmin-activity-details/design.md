# Landing Garmin 活动明细与地图交互 — Technical Design

## 1. Architecture

```text
Garmin Connect (read-only, unofficial)
  │
  ├─ activity list / summary / details / splits / zones / gear / FIT
  ├─ daily health domains
  ▼
Python worker
  ├─ encrypted private archive (all available history)
  ├─ queryable normalized summaries
  ├─ stream cursors + bounded backfill
  └─ public projection + static WebP cover
  ▼
MySQL
  ├─ private Garmin tables (never queried by public controllers)
  ├─ garmin_activity_snapshot (explicit public whitelist)
  └─ public cover media
  ▼
NestJS Garmin module
  ├─ GET /garmin/stats
  ├─ GET /garmin/activities/:publicId
  └─ GET /garmin/covers/:coverId.webp
  ▼
Vue Landing
  ├─ map/pin activity cards
  ├─ pointer tilt
  └─ shared-element modal detail
```

The Python worker remains the only component that decrypts Garmin credentials, calls Garmin Connect, or processes exact coordinates and private health payloads. NestJS reads public projections only.

## 2. Data Layers

### 2.1 Private activity index

New `garmin_private_activity` table:

| Column | Purpose |
|---|---|
| `id` | Internal numeric PK |
| `sourceActivityId` | Garmin id, unique, private |
| `activityUuid` | Optional Garmin UUID, private |
| `activityType` | Normalized type key; supports unknown/future types |
| `privacyType` | Upstream visibility; does not gate private collection |
| `startedAtGmt` / `startedAtLocal` | Preserve both time meanings |
| `sourceUpdatedAt` | Detect activity edits |
| `lastSeenAt` | Reconciliation |
| `detailStatus` | pending / complete / partial / failed |
| `createdAt` / `updatedAt` | Local lifecycle |

All Garmin activity types are archived generically. The eight requested types receive normalized public-detail presets; unknown types still retain raw data.

### 2.2 Encrypted private payloads

New `garmin_private_payload` table:

| Column | Purpose |
|---|---|
| `id` | PK |
| `domain` | activity / health |
| `ownerKey` | private activity PK or calendar date |
| `payloadKind` | list, summary, details, splits, typed_splits, split_summaries, weather, HR zones, power zones, gear, FIT, or health domain |
| `contentType` | JSON or FIT binary |
| `compression` | gzip for canonical JSON; none/gzip for binary |
| `ciphertext` / `nonce` / `authTag` | AES-256-GCM envelope |
| `encryptionVersion` | Key/version migration |
| `contentHash` | Dedup/change detection |
| `sourceUpdatedAt` / `fetchedAt` | Provenance |

- Introduce a separate `GARMIN_DATA_ENCRYPTION_KEY`; do not reuse the token key.
- AAD binds domain, owner, payload kind and encryption version to prevent row swapping.
- Canonical JSON is compressed before encryption.
- FIT is preserved as the richest sensor-level source. Apply a configurable safety cap and record a partial state rather than crashing the invocation.
- Logs never include payloads, values, ids, dates, coordinates or health readings.

### 2.3 Normalized private summaries

Use two query-friendly tables so later public projections do not need to decrypt and parse every raw payload:

**`garmin_activity_detail`**

- 1:1 with `garmin_private_activity`.
- Nullable normalized fields for duration/moving duration, distance, speed/pace, HR, calories, elevation, cadence, power, training effects, Body Battery delta, steps and lap count.
- Stores normalized compact split JSON for the current display contract.
- Exact coordinate/time-series data remains encrypted only.

**`garmin_health_daily`**

- Unique `calendarDate`, preserving Garmin local date plus local/GMT boundary timestamps where available.
- Nullable daily summaries for Body Battery, stress, HR/resting HR, steps, sleep, HRV, SpO2, respiration, hydration, intensity minutes and body composition.
- Full sequences and nested source responses remain encrypted in `garmin_private_payload`.
- No public/admin API in this task.

### 2.4 Public projection

Keep `garmin_activity_snapshot` as the Landing read model. Extend it with:

- `publicId`: random, stable, non-source-derived identifier.
- `detailData`: safe JSON matching the shared detail DTO.
- `coverId`: nullable random cover identifier.
- existing coordinate-free SVG fields retained as a rollback/fallback during migration.

Only activities whose upstream visibility is explicitly `public/everyone` enter the projection. Private archive visibility never leaks into public eligibility.

### 2.5 Public cover media

New `garmin_activity_cover` table:

- `coverId` random unique public identifier;
- internal activity FK/source relation;
- WebP bytes, content type, width, height, byte size and SHA-256 ETag;
- provider, attribution, render version and generated timestamp.

WebP contains no EXIF, GPS or upstream metadata.

## 3. Sync Orchestration

### 3.1 Streams and cursors

New `garmin_sync_stream_state` holds one row per stream:

- `activity-list`
- `activity-detail`
- `health:<domain>`
- `cover`

Each row stores cursor, backfill-complete flag, last attempted/success timestamps, status, error category and consecutive failure count. Existing `garmin_sync_state` remains the public Landing health summary.

### 3.2 Invocation priority

Each 30-minute invocation has a global upstream request budget and processes:

1. refresh token and acquire existing singleton lease;
2. incremental recent activities and today/yesterday health first;
3. changed/new activity details;
4. one bounded historical activity/health backfill slice;
5. covers for the current newest six public candidates;
6. atomically update per-stream cursors and overall public state.

This keeps current data fresh while full history converges over many invocations.

### 3.3 Idempotency and change detection

- Activity id uniquely owns the archive row.
- Payload uniqueness is `(domain, ownerKey, payloadKind)`.
- Canonical content hash skips unchanged encrypted rewrites.
- `sourceUpdatedAt` or recent-window reconcile triggers detail refresh.
- Health uses `(calendarDate, dataKind)` and always rechecks a small recent window for late Garmin corrections.
- Historical rows are never deleted because of age.
- Deleted upstream activities remain in the private archive with a reconciliation status but are removed from the public projection.

### 3.4 Partial failures

Endpoint granularity is independent: weather, zones or one health domain may fail without losing summary/details already fetched. Authentication stops all reads and records `reauth_required`; rate limits preserve cursors and retry later with backoff. Existing public snapshots and covers remain available.

The current environment mismatch must be resolved: `MySQLRepository` expects `GARMIN_MYSQL_*`, while `s.yaml` supplies `MYSQL_*`. Use one documented fallback contract across local/systemd/FC before expanding deployment.

## 4. Field Normalization and Public Detail DTO

### 4.1 Shared contracts

Extend `@applog/common` with:

```ts
interface IGarminActivityCover {
  url: string
  width: number
  height: number
  attribution: string | null
}

interface IGarminActivitySplit {
  index: number
  type: string | null
  distanceMeters: number | null
  durationSeconds: number | null
  averagePaceSecondsPerKm: number | null
  averageHeartRateBpm: number | null
}

interface IGarminLandingActivityDetail {
  publicId: string
  type: string
  typeDisplay: string
  date: string
  distanceMeters: number | null
  durationSeconds: number
  movingDurationSeconds: number | null
  calories: number | null
  averagePaceSecondsPerKm: number | null
  averageSpeedMetersPerSecond: number | null
  maxSpeedMetersPerSecond: number | null
  averageHeartRateBpm: number | null
  maxHeartRateBpm: number | null
  elevationGainMeters: number | null
  averageCadencePerMinute: number | null
  averagePowerWatts: number | null
  trainingEffect: number | null
  bodyBatteryDelta: number | null
  lapCount: number | null
  splits: IGarminActivitySplit[]
}
```

`IGarminLandingActivity` adds `publicId` and `cover`; it does not embed the full detail payload.

### 4.2 Public endpoints

- `GET /garmin/stats`: newest six public cards, safe summary + cover descriptor.
- `GET /garmin/activities/:publicId`: lazy safe detail; only succeeds while the projection row is published.
- `GET /garmin/covers/:coverId.webp`: raw Fastify response with WebP, ETag and long immutable cache.

No endpoint exposes private health data, source activity id, raw payloads, FIT, coordinates or time-series.

### 4.3 Metric presets

Frontend owns presentation order; the API owns safe typed values.

| Type | Core | Secondary |
|---|---|---|
| soccer | duration, distance, calories | avg/max HR, max speed, training effect |
| running | distance, duration, pace | avg/max HR, elevation, cadence, power, training effect |
| track_running | distance, duration, pace, laps | avg/max HR, cadence, power, compact splits |
| treadmill_running | distance, duration, pace | avg/max HR, cadence, power, training effect |
| cycling | distance, duration, avg speed | max speed, avg/max HR, elevation, conditional power/cadence |
| elliptical | duration, calories, avg HR | max HR, cadence, training effect; distance deemphasized/hidden |
| indoor_cardio | duration, calories, avg HR | max HR, training effect, Body Battery delta |
| stair_climbing | duration, calories, avg HR | max HR, cadence, training effect |

Null values are omitted. Zero is retained only when it is a valid observed value.

## 5. Map Cover Rendering

- Use `py-staticmaps==0.5.0` with Pillow; no Cairo native dependency.
- Render at 2x, apply generous bbox padding, draw restrained route/start/end marks, downsample with LANCZOS and encode WebP.
- Production tile URL/provider/attribution/User-Agent are configuration, not hard-coded.
- Do not use `tile.openstreetmap.org` for background generation because its official policy prohibits offline/background bulk use.
- Initial provider direction is a licensed dark OSM-derived raster source such as CARTO Dark Matter; deployment must verify current provider terms. Provider substitution requires config/render-version change, not frontend changes.
- Generate only for current public candidates, not the full private archive.
- If tiles fail, keep the last successful cover; if none exists, use the coordinate-free route fallback. Data sync still succeeds.
- Indoor/no-GPS cover is locally rendered with a centered pin on a quiet dark field; it needs no tile request.

## 6. Landing Interaction Design

### 6.1 Visual role

Impeccable mode: **Persuade**, within an established Apple-light visual world. The Garmin section is personal evidence, not a dashboard. The map is the focal material; metrics remain quiet and typographic.

### 6.2 Card

- Existing horizontal track remains.
- Cover becomes the dominant square image; attribution remains legible but quiet.
- Pointer-fine hover: small scale and bounded `rotateX/rotateY` based on normalized pointer position.
- Reset on leave, blur, scroll start and dialog open.
- Touch has no tilt; keyboard focus gets a clear static edge.
- `will-change` is active only during interaction.

### 6.3 Shared-element modal

Reuse the Reka UI `Dialog` for focus lock, Escape, overlay and focus return.

Primary animation uses a temporary, `aria-hidden`, pointer-inert visual clone:

1. capture the clicked card rect after resetting tilt;
2. open the dialog with destination content visually held;
3. animate the clone from source rect/radius to destination media shell using WAAPI/FLIP;
4. reveal the live dialog content and remove the clone;
5. reverse to the current source rect on close, or fade if the source is no longer visible.

This avoids relying solely on browser View Transitions support. Resize/cancel settles immediately. `prefers-reduced-motion` skips spatial movement and uses a brief opacity transition.

Desktop modal: large centered surface, map left and metric hierarchy right. Mobile: near-full-screen vertical surface. No nested dashboard cards; core metrics use type scale, secondary values use a flat definition grid, splits use a short restrained list.

### 6.4 Detail loading/error

Card click opens immediately using summary data. Detail API loads lazily:

- loading: quiet metric skeleton without delaying shared-element motion;
- success: populate type preset;
- failure: keep cover and summary, show one restrained retry action;
- repeated open may use an in-memory per-publicId cache.

## 7. Compatibility, Operations and Rollback

- Existing snapshot rows remain readable while new nullable columns backfill.
- Existing SVG route remains the no-cover fallback.
- Deploy TypeORM schema before the expanded worker writes new columns/tables.
- Back up Garmin tables and inspect synchronize SQL in staging before production.
- Feature flags/config can independently disable:
  - private detail backfill,
  - health backfill,
  - map generation,
  - public detail endpoint/UI.
- Rollback preserves private archive and old public summary. Disabling the new UI reverts to current cards without deleting collected data.
- Non-official Garmin schema risk is isolated in the adapter + normalizer; synthetic fixtures mirror the 2026-07-28 field matrix without committing real account data.
