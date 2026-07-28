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
- Cover: route present → GPS SVG; else → type-specific static SVG (`ActivityTypeCover`). No soccer heatmap without real pitch data.
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
- Base: elliptical / soccer, no route → static SVG cover; omit distance/location if null.
- Bad: private activity, or location `"31.2, 121.5"` → not published / location null.

### 6. Tests Required

- Worker: TYPE_LABELS for elliptical / track_running / soccer; calories/location accept/reject.
- Backend: public DTO includes new fields; JSON must not contain `latitude` / `longitude` / `sourceActivityId`.
- Frontend utils: `formatDistance` / `formatCalories` return null when absent; route endpoint safety.

### 7. Wrong vs Correct

#### Wrong
```ts
// Expose start coordinates or fake soccer heatmap from missing data
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

## Boundaries

- Only the Python worker decrypts Garmin tokens and calls Garmin Connect.
- NestJS serves whitelist snapshots only.
- `TYPE_LABELS` in worker is the authority for Chinese activity names (upsert refreshes display labels).

## Verification

Worker unittest (`test_normalize` / `test_sync`), `packages/backend/test/garmin.service.spec.ts`, `packages/frontend/test/garmin-utils.spec.mjs`, `@applog/common` build, frontend type-check on touched files.
