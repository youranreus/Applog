# Quality Guidelines

> Build and contribution standards for `@applog/common`.

---

## Overview

Keep the package tiny, strict, and buildable before dependents. There is no test suite in this package today.

---

## Build & Tooling

| Item | Value |
|------|-------|
| Module | ESM (`"type": "module"`) |
| Compiler | `tsc` → `dist/` + `.d.ts` |
| Scripts | `pnpm --filter @applog/common run build` / `run dev` |
| Runtime deps | None |
| Dev deps | `typescript` only |

Note: backend compiles as CommonJS while common is ESM; workspace linking works today — avoid adding features that assume Node CJS `require` of TS sources.

---

## Contribution Checklist

1. Pure functions only in `utils/`.
2. No `console` side effects.
3. Update `src/index.ts` barrel when adding files.
4. Run build after changes so `dist/` types exist for dependents (Turbo usually handles order).

---

## Forbidden Patterns

| Pattern | Reason |
|---------|--------|
| Framework imports (Nest/Vue/…) | Violates shared boundary |
| HTTP clients / DB access | Wrong layer |
| Placeholder exports | Breaks agent trust in specs |
| Skipping `.js` suffix on internal imports | Breaks ESM emit resolution |

---

## Verification

```bash
pnpm --filter @applog/common run build
```

Then ensure a consumer still typechecks, e.g.:

```bash
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/backend run build
```
