# Analytics Guidelines

> Site/content PV·UV reporting and admin queries for `@applog/backend`.

---

## Overview

Module: `packages/backend/src/module/analytics/`.  
Entities: `AnalyticsDailyStatEntity`, `AnalyticsDailyVisitorEntity`, `AnalyticsViewHitEntity` under `src/entities/`.

**Separation from `viewCount`**: lifetime `Post`/`Page.viewCount` still increments on public detail GET. Dashboard PV/UV uses this Analytics module (independent report + daily aggregates). Do **not** treat the two metrics as equal.

---

## Scenario: Content view report + admin traffic queries

### 1. Scope / Trigger

- Trigger: new cross-layer analytics API + three MySQL tables (TypeORM `synchronize: true`).
- Affects: public detail pages (report), admin Dashboard (summary / trend / top).

### 2. Signatures

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/analytics/view` | Public (optional JWT) |
| `GET` | `/analytics/summary` | `@AuthRoles('admin')` |
| `GET` | `/analytics/trend` | `@AuthRoles('admin')` |
| `GET` | `/analytics/top` | `@AuthRoles('admin')` |

Controller: `version: [VERSION_NEUTRAL, '1']`.

**Tables**

| Table | Unique key | Role |
|-------|------------|------|
| `analytics_daily_stat` | `(date, scope, scopeId)` | Daily PV/UV aggregates |
| `analytics_daily_visitor` | `(date, scope, scopeId, visitorId)` | Daily UV dedupe |
| `analytics_view_hit` | `(visitorId, contentType, contentId)` | 30-minute PV debounce |

- `date`: `YYYY-MM-DD` in **`Asia/Shanghai`**
- `scope`: `site` \| `post` \| `page`; site uses `scopeId = 0`

### 3. Contracts

**`POST /analytics/view` body**

| Field | Type | Constraints |
|-------|------|-------------|
| `visitorId` | string | UUID v4 |
| `contentType` | `'post' \| 'page'` | enum |
| `contentId` | number | int ≥ 1 |

Response `data`: `{}` (always success envelope for valid DTO; business no-ops still return `{}`).

**`GET /analytics/summary` → `data`**

```ts
{ todayPv, todayUv, last7DaysPv, last7DaysUv } // numbers
```

**`GET /analytics/trend?days=30` → `data`**

```ts
Array<{ date: string; pv: number; uv: number }> // ascending, missing days filled with 0
```

**`GET /analytics/top?type=post|page&days=30&limit=10` → `data`**

```ts
Array<{ contentType; contentId; title; slug; pv; uv }>
```

Sorted by sum(pv) desc over the window. Missing titles → `已删除内容 #<id>`.

**Env**: none beyond existing MySQL. Schema via `synchronize: true` — no manual migration for greenfield tables.

### 4. Validation & Error Matrix

| Condition | Behavior |
|-----------|----------|
| Invalid DTO (`visitorId` / type / id) | ValidationPipe → business validation error |
| Content missing or not `published` | **no-op** `{}` (do not leak existence) |
| JWT present and `user.id === authorId` | **no-op** `{}` (author self-view excluded) |
| Same visitor+content within 30 min | **no-op** `{}` (debounce via `analytics_view_hit`) |
| First hit of day for visitor+scope | insert visitor row → `uv += 1` on that scope |
| Valid counted hit | atomic upsert: `pv = pv + 1`, `uv = uv + delta` on **site** and **content** scopes |
| Non-admin calls summary/trend/top | Auth guard rejection |
| Unexpected DB/runtime error on report | `BusinessException('上报浏览失败，请稍后重试')` |

### 5. Good / Base / Bad Cases

- **Good**: Anonymous visitor opens published post → site + post daily `pv` (+ `uv` if first that day).
- **Base**: Same visitor refreshes same post within 30 min → no PV/UV change.
- **Bad**: Increment Analytics inside Post/Page `findOne`; or `find` → `pv++` → `save` without atomic upsert (race under concurrency).

### 6. Tests Required

| Layer | Assertion points |
|-------|------------------|
| Unit/service | Shanghai date key; debounce window; author exclusion; unpublished no-op |
| Integration | Concurrent reports do not lose PV (upsert); UV only +1 once per visitor/day/scope |
| Manual smoke | Admin Dashboard summary moves; non-admin sees no traffic UI |

### 7. Wrong vs Correct

#### Wrong

```typescript
// Couples lifetime viewCount to dashboard analytics
entity.viewCount += 1;
await repo.save(entity);
await analytics.bumpFromDetail(entity); // do not piggyback GET

// Non-atomic aggregate update
const row = await repo.findOne(...);
row.pv += 1;
await repo.save(row);
```

#### Correct

```typescript
// Detail GET: only viewCount (unchanged rules)
if (entity.status === 'published' && !allowUnpublished) {
  entity.viewCount += 1;
  await repo.save(entity);
}

// Separate public POST /analytics/view → transaction:
// hit debounce → daily visitor orIgnore → atomic ON DUPLICATE KEY UPDATE for stats
```

---

## Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Collection | Dedicated `POST /analytics/view` | Decouple from GET; carry `visitorId`; exclude author cleanly |
| Storage | Daily aggregates + visitor dedupe + hit table | Personal blog volume; no full event log in MVP |
| Timezone | Fixed `Asia/Shanghai` | Stable “today” for CN audience |
| Bots / rate limit | Trust JS client path; no UA blacklist / IP limit in MVP | Crawlers without JS rarely hit POST |
| Self traffic | Logged-in author of that content excluded entirely | Editing/proofreading would pollute daily stats |

---

## Common Mistakes

**Symptom**: Dashboard PV stays 0 while public “N 次浏览” grows.

**Cause**: Only `viewCount` path runs; frontend never calls `/analytics/view`, or author is always logged in while testing.

**Prevention**: Smoke with anonymous browser / cleared auth; confirm `applog_vid` in `localStorage` and Network POST.

**Symptom**: UV never increases on second content same day.

**Cause**: Misreading site UV vs content UV; or `orIgnore` success detection wrong (`affectedRows` / `identifiers`).

**Prevention**: Assert site and content scopes separately; prefer MySQL `affectedRows` then `identifiers` fallback.

---

## Related

- Lifetime detail counts: [Database Guidelines — viewCount](./database-guidelines.md)
- Frontend report + Dashboard UI: `frontend/frontend/hook-guidelines.md`, `frontend/frontend/component-guidelines.md`
- Task artifacts: `.trellis/tasks/archive/**/07-21-pv-uv-analytics/` (after archive)
