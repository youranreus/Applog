# Package Boundaries

> What belongs in `@applog/common` versus package-local code.

---

## Overview

Common is a **cross-layer contract** package, not a dumping ground for duplicated types. Prefer keeping HTTP envelopes, ORM entities, and UI state in their owning packages unless both sides must share the exact same value shape or key convention.

---

## Belongs in Common

| Kind | Current examples |
|------|------------------|
| Shared value shapes | `ISystemBaseConfig` (`src/types/system-config.ts`) |
| Shared key constants | `SYSTEM_CONFIG_KEYS`, `SYSTEM_CONFIG_PREFIX_DEFAULT` |
| Pure key helpers | `getSystemConfigKey`, `isSystemConfigKey`, `isSystemConfigKeySuffix` |

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

## Current Shared Contract (system config)

- DB/config key example: `SYSTEM_BASE_CONFIG` = prefix + `SYSTEM_CONFIG_KEYS.BASE_CONFIG`
- Stored value JSON matches `ISystemBaseConfig`:
  - Required: `title`, `description`, `allowUserLogin`, `allowComment`
  - Optional site meta: `siteFoundedDate?` (`YYYY-MM-DD` or `''`), `icpFilingNumber?` (display string or `''`)
- Frontend prefers `getSystemConfigKey(...)` when calling config APIs
- Backend currently concatenates `${prefix}${SYSTEM_CONFIG_KEYS.BASE_CONFIG}` (semantically equivalent; prefer reusing the helper when touching that code)
- Old configs missing optional fields are treated as unconfigured (`|| ''` / omit display)

References:
- `packages/common/src/types/system-config.ts`
- `packages/common/src/constants/system-config.ts`
- `packages/common/src/utils/system-config.ts`
- `packages/backend/src/module/system-config/system-config.service.ts`
- `packages/frontend/src/stores/useSystemStore/index.ts`
- `packages/frontend/src/api/system-config/getConfig.ts`

---

## Scenario: Extending `ISystemBaseConfig` site meta (founded date / ICP)

### 1. Scope / Trigger
- Trigger: Adding optional fields that both admin settings and public Footer consume via the same `SYSTEM_BASE_CONFIG` JSON blob (cross-layer contract change).

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
| Uptime display | Frontend-only | Local `YYYY-MM-DDT00:00:00` start; text `本站已运行 {d} 天 {h} 时 {m} 分 {s} 秒`; clamp future to 0 |
| ICP link | Frontend-only | `https://beian.miit.gov.cn/` + `target="_blank"` + `rel="noopener noreferrer"` |

### 4. Validation & Error Matrix
| Condition | Behavior |
|-----------|----------|
| Missing optional fields on old JSON | Treat as unconfigured; do not throw |
| Illegal date string (non `YYYY-MM-DD` / invalid calendar day) | Do not show uptime; admin Calendar parses to `undefined` |
| Empty string after clear + save | Persist `''`; hide corresponding Footer item |
| Future founded date | Show zeroed uptime (no negative) |

### 5. Good/Base/Bad Cases
- Good: both fields set → Footer Row2 shows ICP then uptime (desktop ` · `; mobile two lines)
- Base: both empty → no Row2; Row1 Copyright \| Nav unchanged
- Bad: inventing a second `SYSTEM_*` key for these fields, or computing uptime on the server

### 6. Tests Required
- Unit: `site-uptime` helpers — empty/illegal → `null`; 1-day delta copy; future → zeros
- Manual/E2E: save/clear in SystemSettings; Footer visibility matrix (only ICP / only date / both / neither)
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
