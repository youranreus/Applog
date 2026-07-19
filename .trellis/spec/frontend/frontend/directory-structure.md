# Directory Structure

> How `@applog/frontend` source is organized.

---

## Overview

Layered Vue SPA under `packages/frontend/src/`. Views stay thin; data and business logic live in stores/hooks/api.

---

## Directory Layout

```
packages/frontend/src/
├── main.ts / App.vue
├── api/                 # Alova Method factories by domain (user, post, page, system-config)
├── assets/              # base.css (Tailwind v4 + tokens), scss, images, icons
├── components/
│   ├── Layout/          # Header, Footer, UserHeader
│   ├── GlobalLoading.vue / GlobalNotification.vue
│   └── ui/              # shadcn primitives + reusable business UI
├── constants/           # nav, permission route meta
├── hooks/               # Cross-page composables (prefer low business coupling)
├── lib/utils.ts         # cn() for class merging
├── pages/               # Route views + page-local hooks/components
├── router/              # routes + guards/permission.ts
├── stores/              # Pinia stores (one folder per store)
├── types/               # Frontend-local interfaces
└── utils/               # alova.ts, token.ts, markdown/ pipeline
```

References: `.cursor/rules/frontend.mdc`, `packages/frontend/src/main.ts`.

---

## Placement Rules

| Put here | When |
|----------|------|
| `components/ui/<name>/` | shadcn primitive **or** reusable content UI (MarkdownRenderer, Photos, …) |
| `components/Layout/` | Shell chrome shared across routes |
| `pages/<domain>/` | Route-level views |
| `pages/<domain>/components/` | Used by one page domain only |
| `pages/<domain>/hooks/` | Page-specific business composables |
| `src/hooks/` | Reusable across pages (SEO, image preview, …) |
| `stores/useXxxStore/` | Cross-route persistent/shared state |
| `api/<domain>/` | One function (or small set) per HTTP endpoint file |
| `types/` | Frontend DTO/view models not owned by `@applog/common` |

---

## Routing Notes

- History mode: `createWebHistory`
- Lazy imports: `() => import('@/pages/...')`
- Permission meta from `constants/permission.ts` (`requiresAuth`, `roles`)
- Guard waits on `useUserStore.initializeAuth()` promise — `router/guards/permission.ts`

---

## Markdown System Location

Custom remark/rehype pipeline + BBCode registries live under `utils/markdown/`. Vue mappings for BBCode tags live in `components/ui/` (article-card, bili-video, collapse, photos, video-player).

---

## Common Mistakes

### Mistake: Business components dumped at `components/` root

Prefer `components/ui/` for reusable UI, or page-local `pages/.../components/`.

### Mistake: New API calls inside `.vue` files

Wire through `api/` + hook/store `useRequest`/`useWatcher`.
