# Analytics Guidelines

> Umami-backed traffic reporting and admin queries for `@applog/backend`.

---

## Overview

Module: `packages/backend/src/module/analytics/`.  
Legacy entities (`AnalyticsDailyStatEntity`, `AnalyticsDailyVisitorEntity`, `AnalyticsViewHitEntity`) remain registered for schema compatibility but are **no longer written or queried**. Dashboard traffic comes from a self-hosted **Umami** instance via `UmamiClient`.

**Separation from `viewCount`**: lifetime `Post`/`Page.viewCount` still increments on public detail GET. Dashboard Views/Visitors use Umami (independent). Do **not** treat the two metrics as equal.

---

## Scenario: Umami tracker + admin proxy queries

### 1. Scope / Trigger

- Trigger: admin-configurable Umami对接 + public tracker bootstrap + admin Dashboard APIs.
- Affects: public SPA (tracker script), admin System Settings, admin Dashboard summary/trend/top/breakdown.
- Config source: `SYSTEM_UMAMI_CONFIG` in DB（`IUmamiConfig` in `@applog/common`）— **not** `VITE_` / `.env`.

### 2. Signatures

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/analytics/tracker-config` | Public |
| `GET` | `/analytics/umami-config` | `@AuthRoles('admin')` |
| `PUT` | `/analytics/umami-config` | `@AuthRoles('admin')` |
| `GET` | `/analytics/summary` | `@AuthRoles('admin')` |
| `GET` | `/analytics/trend` | `@AuthRoles('admin')` |
| `GET` | `/analytics/top` | `@AuthRoles('admin')` |
| `GET` | `/analytics/breakdown` | `@AuthRoles('admin')` |

Controller: `version: [VERSION_NEUTRAL, '1']`.

**Removed**: `POST /analytics/view`（旧自建上报）.

### 3. Contracts

**`GET /analytics/tracker-config` → `data`**

```ts
{ enabled: boolean; scriptUrl: string; websiteId: string } // 无凭证
```

未配齐或 `enabled === false` → `{ enabled: false, scriptUrl: '', websiteId: '' }`.

**`GET/PUT /analytics/umami-config`**

- Body/response: `IUmamiConfig`（`baseUrl`, `websiteId`, `scriptUrl?`, `username`, `password`, `enabled?`）
- Read: password 脱敏为 `********`（`UMAMI_PASSWORD_MASK`）
- Write: 空密码或占位 = 不修改已存密码
- 通用 `GET /config/:key` 对 `SYSTEM_UMAMI_CONFIG`：**非 admin 拒绝**；admin 读回亦脱敏

**`GET /analytics/summary` → `data`**

```ts
{ todayViews, todayVisitors, last7DaysViews, last7DaysVisitors }
```

**`GET /analytics/trend?days=30` → `data`**

```ts
Array<{ date: string; views: number; visitors: number }> // Asia/Shanghai，缺日补 0
```

**`GET /analytics/top?days=30&limit=10` → `data`**

```ts
Array<{ path: string; title: string; views: number; href: string }>
```

Path 标题映射：`/archives/{slug}.html` → post；`/{slug}.html` → page；否则 `title = path`。

**`GET /analytics/breakdown?dimension=os|device|country&days=30&limit=10` → `data`**

```ts
Array<{ name: string; value: number }> // value = Umami metrics.y（visitors）
```

### 4. Validation & Error Matrix

| Condition | Behavior |
|-----------|----------|
| Umami 未配置 / 凭证不齐 | `BusinessException('流量服务未配置…')` |
| Umami 登录/401 | `BusinessException` 鉴权失败（不泄露密码） |
| Umami 超时 / 非 2xx | `BusinessException('流量服务暂时不可用…')` |
| 非 admin 调 summary/trend/top/breakdown/umami-config | Auth guard 拒绝 |
| 非 admin 经 `getConfig(SYSTEM_UMAMI_CONFIG)` | `BusinessException('Umami 配置仅允许管理员访问')` |
| 经通用 `setConfig` 写 `SYSTEM_UMAMI_CONFIG` | `BusinessException`：须走 `/analytics/umami-config`（防脱敏占位覆盖明文） |

### 5. Good / Base / Bad Cases

- **Good**: 管理端保存齐备配置 → 非 admin 公开页注入 script → admin Dashboard 看到 Views/Visitors。
- **Base**: admin 登录浏览 → 不注入 tracker（并可写 `umami.disabled`）。
- **Bad**: 在 Post/Page `findOne` 里调 Umami；或把 username/password 放进 `tracker-config` / `VITE_`。

### 6. Tests Required

| Layer | Assertion points |
|-------|------------------|
| Unit | Shanghai windows；密码脱敏 / 空密码保留；path→title 映射 |
| Integration | Token 401 刷新重试；未配置错误文案 |
| Manual smoke | 非 admin 有采集；admin 无 script；非 admin 读不到密码；viewCount 仍增 |

### 7. Wrong vs Correct

#### Wrong

```typescript
// 把凭证塞进公开引导
return { enabled: true, scriptUrl, websiteId, username, password };

// 继续写自建日聚合
await dailyStatRepo.save(...);
```

#### Correct

```typescript
return toUmamiTrackerConfig(raw); // 仅 enabled/scriptUrl/websiteId
// admin 查询 → UmamiClient.getStats / getPageviews / getMetrics
```

---

## Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Collection | Browser → Umami tracker | 不自建事件管道 |
| Config | 管理端 SYSTEM_UMAMI_CONFIG | 无需重建前端；凭证不进构建产物 |
| Query | Backend proxy + Bearer login | 前端不持有密码 |
| Timezone | Fixed `Asia/Shanghai` | 与旧「今日」口径一致 |
| Legacy tables | Soft-disable（不硬删） | 可回滚；另开清理任务 |

---

## Common Mistakes

**Symptom**: Dashboard 显示未配置，但 tracker 已加载。

**Cause**: Tracker 只需要 websiteId+scriptUrl；查询还需要 username/password。

**Prevention**: 空态文案区分；系统设置一次填齐。

**Symptom**: admin 测试时 UV 不涨。

**Cause**: admin 故意不加载 tracker。

**Prevention**: 用匿名/无痕窗口验证采集。

---

## Related

- Lifetime detail counts: [Database Guidelines — viewCount](./database-guidelines.md)
- Frontend tracker + Dashboard: `frontend/frontend/hook-guidelines.md`, `frontend/frontend/component-guidelines.md`
- Config contract: `common/shared/package-boundaries.md`
- Task: `.trellis/tasks/07-25-umami-analytics-integration/`
