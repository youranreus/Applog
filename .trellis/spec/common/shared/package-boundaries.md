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
- Stored value JSON matches `ISystemBaseConfig` (`title`, `description`, `allowUserLogin`, `allowComment`)
- Frontend prefers `getSystemConfigKey(...)` when calling config APIs
- Backend currently concatenates `${prefix}${SYSTEM_CONFIG_KEYS.BASE_CONFIG}` (semantically equivalent; prefer reusing the helper when touching that code)

References:
- `packages/common/src/types/system-config.ts`
- `packages/common/src/constants/system-config.ts`
- `packages/common/src/utils/system-config.ts`
- `packages/backend/src/module/system-config/system-config.service.ts`
- `packages/frontend/src/stores/useSystemStore/index.ts`
- `packages/frontend/src/api/system-config/getConfig.ts`

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
