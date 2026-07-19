# Directory Structure

> Layout of `packages/common`.

---

## Overview

Organize by artifact kind, then by domain file name. Current domain: `system-config` only.

---

## Directory Layout

```
packages/common/
├── package.json          # name: @applog/common, type: module
├── tsconfig.json         # strict, declaration: true, outDir: dist
└── src/
    ├── index.ts          # barrel: export * from types/constants/utils
    ├── types/
    │   └── system-config.ts      # ISystemBaseConfig
    ├── constants/
    │   └── system-config.ts      # SYSTEM_CONFIG_* keys/prefix
    └── utils/
        └── system-config.ts      # getSystemConfigKey, isSystemConfigKey, …
```

Reference: `packages/common/src/index.ts`.

---

## Adding a New Domain

When sharing a second domain (e.g. pagination contracts):

1. Add `src/types/<domain>.ts`, optionally `constants/` + `utils/`.
2. Re-export from `src/index.ts`.
3. Keep one concern per file; avoid dumping unrelated symbols into `system-config.ts`.

---

## Import Style Inside the Package

Internal relative imports **must** use `.js` extensions (ESM emit):

```typescript
import { SYSTEM_CONFIG_KEYS } from '../constants/system-config.js';
```

Reference: `packages/common/src/utils/system-config.ts`.

---

## Consumers

| Package | Typical import |
|---------|----------------|
| Backend | `import type { ISystemBaseConfig } from '@applog/common'` |
| Frontend | `import { SYSTEM_CONFIG_KEYS, getSystemConfigKey } from '@applog/common'` |

Do not deep-import `packages/common/src/...` from other packages — use the package name.
