# Package Boundaries

> What belongs in `@applog/common` versus package-local code.

---

## Overview

Common is a **cross-layer contract** package, not a dumping ground for duplicated types. Prefer keeping HTTP envelopes, ORM entities, and UI state in their owning packages unless both sides must share the exact same value shape or key convention.

---

## Belongs in Common

| Kind | Current examples |
|------|------------------|
| Shared value shapes | `ISystemBaseConfig`, `IUmamiConfig`, `IUmamiTrackerConfig` (`src/types/system-config.ts`) |
| Shared key constants | `SYSTEM_CONFIG_KEYS`, `SYSTEM_CONFIG_PREFIX_DEFAULT`, `UMAMI_PASSWORD_MASK` |
| Pure key / Umami helpers | `getSystemConfigKey`, `isSystemConfigKey`, `toUmamiTrackerConfig`, `maskUmamiConfigPassword`, … |

Criteria (all should be true):
1. Frontend **and** backend need the same definition, or will soon.
2. Pure TypeScript — no framework decorators or I/O.
3. Stable enough to version as a workspace contract.

---

## Does NOT Belong in Common

| Keep out | Where it lives today |
|----------|----------------------|
| NestJS modules/services/controllers | `packages/backend/src/module/` |
| TypeORM entities | `packages/backend/src/entities/` |
| class-validator request DTOs | `packages/backend/src/module/*/dto/` |
| Vue components, Pinia stores, hooks | `packages/frontend/src/` |
| Alova API wrappers | `packages/frontend/src/api/` |
| API response envelopes | Duplicated today as `IConfigResponseDto` in backend DTO + frontend `types/system-config.ts` |
| Env reading / admin permission logic | Backend `ConfigService` + `SystemConfigService.ensureSystemKeyAccess` |
| SSO / JWT payload types | `@reus-able/types` |

---

## Current Shared Contracts

### System base config

- DB/config key example: `SYSTEM_BASE_CONFIG` = prefix + `SYSTEM_CONFIG_KEYS.BASE_CONFIG`
- Stored value JSON matches `ISystemBaseConfig`:
  - Required: `title`, `description`, `allowUserLogin`, `allowComment`
  - Optional site meta: `siteFoundedDate?` (`YYYY-MM-DD` or `''`), `icpFilingNumber?` (display string or `''`)
  - Optional Landing meta: `landingTitle?`, `landingBio?`, `landingSlogan?`, `weatherCity?`, `personalHomepageUrl?`, `bilibiliUrl?`, `githubUrl?`
- Frontend prefers `getSystemConfigKey(...)` when calling config APIs
- Backend currently concatenates `${prefix}${SYSTEM_CONFIG_KEYS.BASE_CONFIG}` (semantically equivalent; prefer reusing the helper when touching that code)
- Old configs missing optional fields follow each field's contract below; do not collapse missing and explicit empty with `||`

### Umami config

- Key: `SYSTEM_UMAMI_CONFIG` = prefix + `SYSTEM_CONFIG_KEYS.UMAMI_CONFIG`
- Shape: `IUmamiConfig`（`baseUrl`, `websiteId`, `scriptUrl?`, `username`, `password`, `enabled?`）
- **权限例外**：完整配置（含凭证）仅 admin；通用 `getConfig` 对非 admin 拒绝；读回密码脱敏 `UMAMI_PASSWORD_MASK`；通用 `setConfig` **禁止**写入该 key（须走 `/analytics/umami-config`）
- 公开引导：`IUmamiTrackerConfig` via `GET /analytics/tracker-config`（无凭证）
- Helpers: `toUmamiTrackerConfig`, `maskUmamiConfigPassword`, `isUmamiQueryConfigured`, …

References:
- `packages/common/src/types/system-config.ts`
- `packages/common/src/constants/system-config.ts`
- `packages/common/src/utils/system-config.ts`
- `packages/common/src/utils/umami-config.ts`
- `packages/backend/src/module/system-config/system-config.service.ts`
- `packages/frontend/src/stores/useSystemStore/index.ts`
- `packages/frontend/src/api/system-config/getConfig.ts`
- `packages/frontend/src/api/analytics/umamiConfig.ts`

---

## Scenario: Extending `ISystemBaseConfig` site meta (Footer / Landing)

### 1. Scope / Trigger
- Trigger: Adding optional fields that admin settings and public Footer/Landing consume via the same `SYSTEM_BASE_CONFIG` JSON blob (cross-layer contract change).

### 2. Signatures
- Type: `ISystemBaseConfig` in `packages/common/src/types/system-config.ts`
- Storage key: `${SYSTEM_CONFIG_PREFIX}BASE_CONFIG` (still one JSON document; no new `SYSTEM_CONFIG_KEYS` entry)
- Backend init: `SystemConfigService.initializeSystem` default object must include new fields as `''`
- Frontend write: `SystemSettings.vue` → `setConfig({ configKey, configValue: JSON.stringify(formData) })`
- Frontend read: `useSystemStore.config` parsed as `ISystemBaseConfig`

### 3. Contracts
| Field | Type | Constraints |
|-------|------|-------------|
| `siteFoundedDate` | `string?` | ISO date `YYYY-MM-DD` or `''`; empty / missing = Footer hides uptime |
| `icpFilingNumber` | `string?` | Free text or `''`; empty / missing = Footer hides ICP link |
| `landingTitle` | `string?` | Missing/empty = system title; otherwise Landing H1 |
| `landingBio` | `string?` | Landing subtitle; missing = legacy default copy; trimmed empty = hide |
| `landingSlogan` | `string?` | Missing = legacy default copy; trimmed empty = hide |
| `weatherCity` | `string?` | Missing/non-string/empty = weather disabled; backend trims before provider lookup |
| `personalHomepageUrl` | `string?` | Missing = `/about.html`; empty = hide; allow `/...` or HTTP(S) |
| `bilibiliUrl` | `string?` | Missing/empty = hide; HTTP(S) only |
| `githubUrl` | `string?` | Missing = legacy GitHub default; empty = hide; HTTP(S) only |
| Uptime display | Frontend-only | Local `YYYY-MM-DDT00:00:00` start; text `本站已运行 {d} 天 {h} 时 {m} 分 {s} 秒`; clamp future to 0 |
| ICP link | Frontend-only | `https://beian.miit.gov.cn/` + `target="_blank"` + `rel="noopener noreferrer"` |

### 4. Validation & Error Matrix
| Condition | Behavior |
|-----------|----------|
| Missing optional Footer fields on old JSON | Treat as unconfigured; do not throw |
| Illegal date string (non `YYYY-MM-DD` / invalid calendar day) | Do not show uptime; admin Calendar parses to `undefined` |
| Empty string after clear + save | Persist `''`; hide corresponding Footer item |
| Future founded date | Show zeroed uptime (no negative) |
| Old JSON missing Landing fields | Apply the documented legacy defaults; do not mutate stored JSON merely by reading |
| Explicit empty Landing text/link | Persist `''` and hide; never replace it with a fallback via `||` |
| Invalid or dangerous URL protocol | Frontend normalizer returns `null`; do not render `href` |

### 5. Good/Base/Bad Cases
- Good: both fields set → Footer Row2 shows ICP then uptime (desktop ` · `; mobile two lines)
- Base: both empty → no Row2; Row1 Copyright \| Nav unchanged
- Bad: inventing a second `SYSTEM_*` key for these fields, or computing uptime on the server
- Landing good: missing legacy fields retain the previous homepage copy; admin saving `''` hides exactly that item.
- Landing bad: using `value || fallback`, which makes an explicit empty string impossible to distinguish from a missing field.

### 6. Tests Required
- Unit: `site-uptime` helpers — empty/illegal → `null`; 1-day delta copy; future → zeros
- Manual/E2E: save/clear in SystemSettings; Footer visibility matrix (only ICP / only date / both / neither)
- Unit/manual: Landing missing-vs-empty semantics; internal homepage vs external URL; dangerous protocol hidden; malformed `weatherCity` soft-disables weather.
- Type-check after `pnpm --filter @applog/common run build`

### 7. Wrong vs Correct
#### Wrong
```typescript
// Separate SYSTEM_ICP key + native <input type="date"> only on FE types
interface ILocalConfig { founded: Date }
```
#### Correct
```typescript
// Extend shared ISystemBaseConfig; store YYYY-MM-DD string; FE Calendar ↔ string
siteFoundedDate?: string;
icpFilingNumber?: string;

// Missing and explicit empty stay distinguishable.
const source = value === undefined ? legacyFallback : value;
```

---

## Expanding Shared Types

User/post/page DTO shapes are **not** in common today (each package defines its own). Only promote a type to common when both sides already drift or must guarantee identical fields — do not bulk-move all DTOs as a cleanup.

---

## Anti-Patterns

| Avoid | Why |
|-------|-----|
| Adding Vue/Nest imports to common | Breaks the pure-library boundary |
| Putting `IConfigResponseDto` in common “just because it exists twice” | Still HTTP-layer; only share if product wants one envelope contract |
| Side-effecting utils (fetch, fs, process.env) | Belongs in owning package |
| Subpath exports / deep imports | Package exposes a single root entry today |
