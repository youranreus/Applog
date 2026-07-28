# Garmin 运动数据公开展示 — Technical Design

## Architecture and Boundaries

```text
Trusted local provisioning CLI
  Garmin email/password/MFA
            |
            v
  encrypted token record in MySQL
            |
            v
Linux systemd Python 3.12 timer worker (read-only)
  python-garminconnect adapter
  activity normalization + SVG route builder
            |
            v
MySQL: encrypted credential + sync state + public activity snapshots
            |
            v
NestJS Garmin module -> public whitelist DTO
            |
            v
Vue Landing Garmin section
```

The Python worker is the only component that can decrypt Garmin tokens or call Garmin. NestJS never imports `python-garminconnect` and serves only persisted, publication-safe snapshots. Public page requests never trigger Garmin calls.

## Components

### 1. Python sync worker

Place the worker in a standalone workspace such as `workers/garmin-sync/` with its own `pyproject.toml`, lock/requirements, handler, adapter, normalization code and tests.

Responsibilities:

- load and decrypt the persisted token store;
- initialize `Garmin(is_cn=<config>)` from tokens without a password;
- call `count_activities()` for the all-history count;
- page through `get_activities_by_date()` for the rolling 12-month window;
- accept only activities explicitly marked public; unknown visibility fails closed;
- obtain route points for GPS running activities from `get_activity_details(maxpoly=4000)`, with GPX download as a compatibility fallback;
- normalize source payloads into an internal typed model;
- generate safe SVG path data, upsert snapshots and update sync state in a transaction;
- persist refreshed tokens after successful refresh;
- checkpoint backfill and route work so one invocation remains bounded.

The adapter exposes only read methods. Do not expose generic `connectapi`, upload, edit or delete methods to the synchronization service.

### 2. Persistence

Add TypeORM entities and matching worker SQL access for three concepts:

#### GarminCredential

- singleton id;
- ciphertext, nonce/IV, authentication tag, encryption version;
- created/updated timestamps.

The AES-256-GCM key is supplied as `GARMIN_TOKEN_ENCRYPTION_KEY` through the shared protected backend dotenv files, but only the worker/provisioning CLI reads it. Token rotation writes a complete new encrypted envelope atomically.

#### GarminActivitySnapshot

- internal primary key;
- unique `sourceActivityId` used only server-side;
- normalized activity type key and display label;
- activity date, distance meters, duration seconds;
- optional device model;
- optional safe route `pathData` plus fixed viewBox metadata;
- source visibility, published flag, source updated timestamp;
- last seen/synced timestamps.

No latitude, longitude, GPX, FIT, raw JSON or account id columns are allowed.

#### GarminSyncState

- singleton id;
- total historical activity count;
- backfill cursor/status;
- last attempted and last successful timestamps;
- status: `never_synced | healthy | degraded | reauth_required`;
- non-sensitive error category only.

### 3. Route transformation

Input points exist only in worker memory:

1. validate finite latitude/longitude values and remove consecutive duplicates;
2. preserve the first and final valid point exactly in the working sequence;
3. project with a local equirectangular projection using mean latitude;
4. simplify intermediate points with a bounded Ramer–Douglas–Peucker tolerance while preserving endpoints;
5. normalize into a padded, coordinate-free SVG viewBox and invert Y for screen coordinates;
6. cap point count and decimal precision, then serialize only `M/L` path commands;
7. validate path length and grammar before persistence.

Degenerate tracks with fewer than two distinct valid points produce no route preview. The frontend binds the validated string to an SVG `<path d>`; it never renders upstream SVG/HTML via `v-html`.

### 4. NestJS Garmin module

Add an isolated `garmin` module with repository/service/controller boundaries. The public endpoint follows the Duolingo soft-degradation pattern but performs no upstream calls:

`GET /v1/garmin/stats -> IGarminLandingStats | null`

Proposed public contract:

```ts
interface IGarminLandingStats {
  totalActivityCount: number;
  activities: Array<{
    type: string;
    date: string; // YYYY-MM-DD
    distanceMeters: number | null;
    durationSeconds: number;
    deviceSource: string | null;
    route: null | {
      pathData: string;
      viewBox: string;
    };
  }>;
  fetchedAt: string;
  stale: boolean;
}
```

Query only `published = true`, order newest first and limit six. Compute `stale` from sync state (recommended threshold: more than six hours since last success). Do not return internal ids or error details.

### 5. Vue Landing section

Add an independent API method and request hook so failure never blocks Landing. Render a restrained “运动轨迹” section after recent posts and before/near the existing Duolingo section:

- all-history count as the quiet summary;
- six compact activity rows/cards with localized type, date, distance and duration;
- route SVG only when present, with `preserveAspectRatio` and accessible label;
- Garmin Connect/device attribution adjacent to the section title or activity metadata;
- skeleton while loading, no section when response is null, stale note when applicable.

Avoid map controls, tooltips, hover-only information, card-wall density or route animation in MVP.

## Sync Flow

1. Timer invokes worker every 30 minutes.
2. Worker acquires a database advisory/singleton lease; concurrent invocation exits safely.
3. Decrypt and validate token; authentication errors set `reauth_required` without password retries.
4. Fetch total count and recent activity pages.
5. Process a bounded batch of unresolved 12-month backfill/route items, updating checkpoint state.
6. In one transaction, upsert normalized snapshots, reconcile missing/non-public/out-of-window records, store refreshed token and advance sync state.
7. NestJS continues serving the last committed snapshot throughout the run.

Network timeout/429 errors use one bounded retry with jitter. Route failure is per-activity degradation; core activity metadata may still publish without SVG and be retried later.

## Compatibility and Migration

- Additive tables and endpoint only; no existing API contract changes.
- Existing Landing remains functional when tables are empty or worker is disabled.
- 服务器通过 bootstrap 脚本安装独立 Python 3.12 虚拟环境并注册 systemd service/timer；现有 Node 服务仅增加数据库实体和模块注册。
- Because the project currently uses TypeORM `synchronize: true`, backend startup creates additive tables. Deployment order must be backend schema first, then provision tokens, then enable timer.
- Real-account payloads must be captured only as manually sanitized fixtures; never commit actual account/location data.

## Security and Privacy

- Password and MFA code are accepted only by the local provisioning CLI and never persisted.
- Refresh token is treated as a password-equivalent secret and encrypted at rest with authenticated encryption.
- NestJS does not consume, serialize or log the worker encryption key even though deployment keeps it in the shared protected dotenv files.
- Logs use allowlisted metadata only and never serialize caught response bodies or request headers.
- Source visibility fails closed. A private/unknown activity is never inserted as published.
- Public DTO and database schema structurally prevent raw geolocation disclosure; only normalized path geometry is retained.
- Full start/end route shape remains visible by explicit product decision.

## Operations and Rollback

- Metrics/logs: sync duration, fetched count, upsert count, route success/failure count, stale age and error category.
- `reauth_required` is actionable through logs/admin diagnostics but not exposed publicly.
- To roll back, disable/remove the timer trigger first. The public endpoint continues serving snapshots; removing the Landing component hides the feature without deleting data.
- Re-provisioning replaces encrypted tokens without clearing activity snapshots.
- If Garmin changes schema, disable the trigger, update adapter fixtures/parser, validate against the account, then resume.

## Key Trade-offs

- Automatic sync is achieved at the cost of relying on an unofficial API.
- A separate Python systemd service adds deployment surface but isolates credentials, runtime churn and upstream failures from reader traffic.
- Persisting normalized SVG geometry prevents later map reconstruction; visual changes requiring raw coordinates must re-fetch Garmin data.
- Full-route display maximizes authenticity but retains recognizable route-shape privacy risk.
