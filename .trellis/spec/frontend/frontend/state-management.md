# State Management

> Pinia + Alova data flow in `@applog/frontend`.

---

## Overview

Global/cross-route state uses Pinia setup stores (`defineStore(id, () => { ... })`). Server fetching is usually embedded via Alova `useRequest` inside the store or a page hook. There is no Vuex / no Axios.

---

## Store Inventory

| Store | Path | Responsibility |
|-------|------|----------------|
| `useUserStore` | `stores/useUserStore/` | Auth user, token, SSO login/callback, `initializeAuth()` |
| `useSystemStore` | `stores/useSystemStore/` | Base system config from `@applog/common` key |
| `useLayoutStore` | `stores/useLayoutStore/` | Nav pages, `notify()` queue for Sonner bridge |
| `usePostListStore` | `stores/usePostListStore/` | Public post list filters/pagination |
| `useAdminStore` | `stores/useAdminStore/` | Admin composite services (e.g. `composite/useAdminPostListService.ts`) |

Pattern reference: `packages/frontend/src/stores/useUserStore/index.ts`.

---

## Auth Bootstrap

`main.ts` starts auth before navigation:

```typescript
const authInitPromise = userStore.initializeAuth();
setupPermissionGuard(authInitPromise);
```

Guard (`router/guards/permission.ts`):
1. Await auth init
2. If `meta.requiresAuth` and logged out → `/user/login?redirect=...`
3. If `meta.roles` mismatch → `/403`

Permission constants: `packages/frontend/src/constants/permission.ts` (`USER_ROLES`, `ROUTE_PERMISSIONS`).

Token persistence: `utils/token.ts` + `localforage` (user profile also in localforage).

---

## API Layer

- Files under `src/api/<domain>/` export functions returning `alovaInstance.Get/Post/Put/Delete<T>(...)`.
- `T` is the **inner data** type after interceptor unwrap.
- Interceptor (`utils/alova.ts`): injects `Authorization: Bearer`, throws when `code !== 0`, returns `data`, `cacheFor: null`.

Example: `packages/frontend/src/api/post/getPostList.ts`.

---

## Notifications

Use `useLayoutStore().notify(...)`. `GlobalNotification.vue` adapts the queue to Sonner. Do not add parallel toast utilities.

### Dangerous settings / irreversible actions

When a form can disable site-wide capabilities (e.g. `allowUserLogin`, `allowComment`) or run one-shot bootstrap (`initializeSystem`):

1. **Confirm first** — `Dialog` with consequence copy before calling the API.
2. **Then persist** — only after confirm, call `useRequest` / save.
3. **Always notify** — success and failure via `layoutStore.notify`; never rely on `console.log`.
4. **Catch-frame errors** — in `catch`, derive the message from the thrown `error` (or a helper), not only from a computed that may still be empty in the same tick.

Reference: `packages/frontend/src/pages/user/Dashboard/components/SystemSettings.vue`, `SystemInitialize.vue`.

---

## When To Use Store vs Page Hook

| Use a store | Use a page hook |
|-------------|-----------------|
| Needed across routes / layout | Single page flow |
| Auth, system config, nav | Detail fetch, edit form submit |
| Admin module composition | Thin adapters that call admin store |

---

## Anti-Patterns

| Avoid | Prefer |
|-------|--------|
| Fetching in components with raw `fetch` | `api/` + Alova hooks |
| Storing derived-only UI flags globally without need | Local `ref` in page hook |
| Second HTTP client | Existing `alovaInstance` |
| Ignoring auth init race | Always go through permission guard + `initializeAuth` |
