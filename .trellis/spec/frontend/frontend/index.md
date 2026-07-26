# Frontend Development Guidelines

> Vue 3 conventions for `@applog/frontend` (`packages/frontend`).

---

## Overview

Stack: Vue 3 + Composition API (`<script setup>`), Pinia, Vue Router, Alova, Tailwind CSS v4, shadcn-vue (Reka UI). Path alias `@/*` → `src/*`.

Shared contracts: `@applog/common` (system config and visitor cursor presence).

---

## Pre-Development Checklist

- [ ] UI lives in `components/` (shared) or `pages/<domain>/` (page-local)
- [ ] Business logic goes in page hooks or Pinia stores — not fat SFCs
- [ ] HTTP goes through `src/api/*` + `alovaInstance` (no Axios / raw fetch)
- [ ] Lists/forms use `useRequest` / `useWatcher` appropriately
- [ ] Types use `I*` interfaces and `as const` instead of `enum`
- [ ] Theme tokens in `assets/base.css` (see Component Guidelines)
- [ ] Analytics: Umami tracker via public `GET /analytics/tracker-config` (non-admin only); Dashboard via admin proxy APIs — do not reuse `viewCount` for traffic UI
- [ ] Visitor cursor changes follow the cross-layer [Visitor Cursor Contract](../../backend/backend/visitor-cursor-guidelines.md)


---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | `src/` layout and placement rules | Filled |
| [Component Guidelines](./component-guidelines.md) | SFC patterns, shadcn, Apple theme tokens | Filled |
| [Hook Guidelines](./hook-guidelines.md) | Public vs page hooks, Alova hooks | Filled |
| [State Management](./state-management.md) | Pinia stores + API layering | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Forbidden patterns, lint/typecheck | Filled |
| [Type Safety](./type-safety.md) | Types, constants, `@applog/common` | Filled |
| [Visitor Cursor Contract](../../backend/backend/visitor-cursor-guidelines.md) | Public-route cursor identity, polling, API, and rendering | Filled |

---

## Quality Check

- [ ] No `any`, no TS `enum`, no `await`+`.then()` mix
- [ ] Pages do not call `alovaInstance` directly
- [ ] Auth-sensitive routes use `ROUTE_PERMISSIONS` / guard meta
- [ ] Notifications go through `layoutStore.notify` (Sonner bridge)
- [ ] Theme changes remap semantic CSS variables — do not one-off restyle every page
- [ ] Dashboard traffic UI: admin-only, list-row tone, SVG trend (no chart library)

---

**Language**: English (code comments may be Chinese).
