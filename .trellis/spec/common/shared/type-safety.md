# Type Safety

> Naming and typing conventions inside `@applog/common`.

---

## Overview

Follow the monorepo TypeScript rules, with a small shared-library twist: exports must stay framework-agnostic and declaration-friendly.

---

## Naming

| Kind | Convention | Example |
|------|------------|---------|
| Interface | `I` + PascalCase | `ISystemBaseConfig` |
| Type alias | PascalCase | (add when needed) |
| Constant | `UPPER_SNAKE_CASE` | `SYSTEM_CONFIG_PREFIX_DEFAULT` |
| Const map | `UPPER_SNAKE_CASE` + `as const` | `SYSTEM_CONFIG_KEYS` |
| Function | camelCase | `getSystemConfigKey` |
| File | kebab-case | `system-config.ts` |

**Do not use TypeScript `enum`.** Use `as const` objects + derived unions.

Reference: `packages/common/src/constants/system-config.ts`.

---

## Export Patterns

1. Define symbols in the appropriate folder file.
2. Re-export from `src/index.ts` with `export * from './...js'`.
3. Consumers should use `import type` for type-only imports.

```typescript
// Consumer (preferred for types)
import type { ISystemBaseConfig } from '@applog/common';
import { SYSTEM_CONFIG_KEYS } from '@applog/common';
```

---

## Documentation

Exported functions require JSDoc with `@param` / `@returns` and a short logic note (Chinese is acceptable and already used).

Reference: `packages/common/src/utils/system-config.ts`.

---

## Anti-Patterns

| Avoid | Prefer |
|-------|--------|
| `any` | Concrete interfaces / generics |
| `enum` | `as const` object |
| Untyped public helpers | Explicit parameter and return types |
| Exporting non-shared Nest/Vue types | Keep those package-local |
