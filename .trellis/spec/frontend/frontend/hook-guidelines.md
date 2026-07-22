# Hook Guidelines

> Composable patterns in `@applog/frontend`.

---

## Overview

Hooks (composables) encapsulate reusable reactive logic. Split **public** hooks (`src/hooks/`) from **page/business** hooks (`pages/**/hooks/` or component-local hooks).

---

## Public Hooks (`src/hooks/`)

Prefer low domain coupling. Current set:

| File | Role |
|------|------|
| `useSeoHead.ts` | `@unhead/vue` meta helpers |
| `useJsonLd.ts` | JSON-LD structured data |
| `useImagePreview.ts` | Click-to-preview images in a container |
| `usePageDetail.ts` | Fetch page by slug + SEO (slightly domain-specific but shared by page routes) |
| `analytics/useAnalyticsViewReport.ts` | After published detail load, silent `POST /analytics/view` (shared by post + page) |

Reference directory: `packages/frontend/src/hooks/`.

Domain-ish but **cross-route** helpers may live under `hooks/<domain>/` (e.g. analytics) instead of duplicating under every `pages/**/hooks`. Prefer page-local hooks when only one route owns the behavior.

---

## Page / Business Hooks

Live next to the feature:

| Example | Path |
|---------|------|
| Public post detail | `pages/post/hooks/usePostDetail.ts` |
| Public post list | `pages/post/hooks/usePostList.ts` |
| Admin post list | `pages/user/PostList/hooks/usePostList.ts` (often proxies admin store) |
| Post editor | `pages/user/PostEdit/hooks/usePostEdit.ts` |
| System config UI | `pages/user/Dashboard/hooks/useSystemConfig.ts` |
| Markdown renderer | `components/ui/markdown-renderer/hooks/useMarkdownRenderer.ts` |

Pattern: `.vue` files call the hook; hook owns `useRequest`/`useWatcher`, derived state, and submit handlers.

### Analytics view report

- Visitor id: `utils/visitor-id.ts` → `localStorage` key `applog_vid` (UUID).
- Call `useAnalyticsViewReport(contentRef, 'post' | 'page')` from detail hooks after data is available.
- Failures are silent; clear in-memory “already reported” marker on failure so a later retry can fire.
- Do not block reading UX on analytics network errors.
- API modules: `src/api/analytics/*` (alova). Admin queries require admin JWT.

---

## Alova Request Hooks

Configured singleton: `packages/frontend/src/utils/alova.ts`.

| Hook | When |
|------|------|
| `useRequest(method\|factory, opts)` | One-shot or store-owned requests; `immediate` controls auto-run |
| `useWatcher(factory, deps, opts)` | Re-fetch when watched deps change (slug/page/filter) |

Examples:
- Store: `useSystemStore` → `useRequest(() => getConfig(...), { immediate: true })`
- Page: `pages/post/hooks/usePostDetail.ts` → `useWatcher`
- Page: `hooks/usePageDetail.ts` → `useWatcher`

API modules return Alova `Method` objects typed as **already unwrapped `data`** (interceptor strips `{ data, code, msg }`).

---

## Layering Rules

1. Views → hooks/stores → `api/*` → `alovaInstance`
2. Do not call `alovaInstance` from SFCs.
3. Put cross-route shared mutable state in Pinia, not a random global hook.
4. JSDoc every exported composable (`@param` / `@returns`, Chinese OK).

---

## Anti-Patterns

| Avoid | Prefer |
|-------|--------|
| Fat SFCs with inline fetch logic | Page hook + `useRequest`/`useWatcher` |
| Duplicating toast/error handling everywhere | Store notify + consistent catch |
| Public hooks that hard-code admin-only flows | Keep admin logic under `pages/user/**` |
| Mixing `.then()` with `await` | `async/await` only |

---

## Reality Note

`usePageDetail` sits in `src/hooks/` but talks to page APIs — acceptable today because multiple routes reuse it. New highly domain-specific hooks should still prefer `pages/<domain>/hooks/`.
