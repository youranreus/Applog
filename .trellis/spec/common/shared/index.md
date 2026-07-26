# Shared Library Guidelines (`@applog/common`)

> Conventions for the workspace shared package at `packages/common`.

---

## Overview

`@applog/common` is a **pure TypeScript ESM library** with zero runtime framework dependencies. It holds cross-layer contracts consumed by both `@applog/backend` and `@applog/frontend`, including system config and visitor cursor presence.

Build output: `dist/` (`main`: `dist/index.js`, `types`: `dist/index.d.ts`). Turbo `dependsOn: ["^build"]` builds this package before dependents.

---

## Pre-Development Checklist

- [ ] Change is needed by **both** frontend and backend (or is a pure shared contract)
- [ ] No NestJS / Vue / TypeORM / Alova / DOM / Node I/O APIs
- [ ] Types go in `src/types/`, constants in `src/constants/`, pure helpers in `src/utils/`
- [ ] Barrel export added in `src/index.ts`
- [ ] Internal imports use ESM `.js` extensions
- [ ] JSDoc added for exported functions

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | `types` / `constants` / `utils` layout | Filled |
| [Package Boundaries](./package-boundaries.md) | What belongs (and does not) in common | Filled |
| [Type Safety](./type-safety.md) | Naming and export patterns | Filled |
| [System Config Contracts](./system-config-contracts.md) | Cross-layer field formats and compatibility rules | Filled |
| [Visitor Cursor Contract](../../backend/backend/visitor-cursor-guidelines.md) | Shared presence types, constants, expiry, and polling rules | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Build, imports, anti-patterns | Filled |

---

## Quality Check

- [ ] No placeholder / TODO fill text
- [ ] New symbols re-exported from `src/index.ts`
- [ ] Frontend/backend can import without pulling framework code
- [ ] `pnpm --filter @applog/common run build` succeeds

---

**Language**: English (code comments may be Chinese).
