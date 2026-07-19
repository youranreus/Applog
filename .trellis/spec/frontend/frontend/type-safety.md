# Type Safety

> TypeScript conventions in `@applog/frontend`.

---

## Overview

Frontend keeps local view/API types under `src/types/`. Cross-package system-config contracts come from `@applog/common`. Project rules forbid casual `any` and TS `enum`.

---

## Naming

| Kind | Convention | Example file |
|------|------------|--------------|
| Interface | `I` + PascalCase | `types/user.ts` → `IUserResponseDto` |
| Type alias / unions | PascalCase | `UserRole`, `PostStatus` |
| Const maps | `UPPER_SNAKE_CASE` + `as const` | `USER_ROLES`, `ROUTE_NAMES` |
| Files | kebab-case or domain name | `post.ts`, `api.ts` |

Reference: `packages/frontend/src/types/post.ts`, `packages/frontend/src/constants/permission.ts`.

---

## API Typing

- Describe raw envelope only when needed: `IRestfulResponse<T>` in `types/api.ts`.
- Alova methods are typed with **unwrapped** `T` because `utils/alova.ts` already returns `data`.
- Prefer `import type` for type-only imports.

---

## Shared Package Types

```typescript
import type { ISystemBaseConfig } from '@applog/common';
import { SYSTEM_CONFIG_KEYS, getSystemConfigKey } from '@applog/common';
```

Used by: `useSystemStore`, `api/system-config/*`, Dashboard system settings.

Do **not** move every frontend DTO into common — only true cross-layer contracts.

---

## Forbidden / Avoided

| Pattern | Status in `src/` |
|---------|------------------|
| `any` | Avoid (effectively unused) |
| `enum` | Avoid — use unions + `as const` |
| Untyped Alova calls | Always provide `T` |
| Duplicating `ISystemBaseConfig` locally | Import from `@applog/common` |

---

## Verification

```bash
pnpm --filter @applog/frontend run type-check
```
