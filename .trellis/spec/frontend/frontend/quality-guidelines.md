# Quality Guidelines

> Code quality standards for `@applog/frontend`.

---

## Overview

Follow existing Vue 3 + Alova + Pinia patterns. Prefer matching `pages/user/*` and `stores/*` over introducing new architectural styles.

Also see: `.cursor/rules/frontend.mdc`, `CLAUDE.md`, root `DESIGN.md` for Apple theme tokens.

---

## Required Practices

1. `<script setup lang="ts">` only.
2. JSDoc on exported functions/composables (Chinese OK).
3. Keep SFCs focused; extract hooks when logic grows (soft target: avoid huge 300+ line pages).
4. `async/await` with `try/catch` — never mix `.then()`.
5. Tailwind-first styling; use `@apply` only inside style blocks when composing utilities.
6. Add shadcn primitives via CLI into `components/ui/` (`pnpm dlx shadcn-vue@latest add <name>`).

---

## Forbidden Patterns

| Pattern | Prefer |
|---------|--------|
| Axios / raw `fetch` for app APIs | `alovaInstance` + `src/api` |
| Options API | `<script setup>` |
| TS `enum` | `type` + `as const` |
| `any` | Precise interfaces |
| Page → HTTP directly | Page hook / store |
| Parallel toast libraries | `layoutStore.notify` → Sonner |
| Hard-coded system config key strings | `SYSTEM_CONFIG_KEYS` / `getSystemConfigKey` |
| Rewriting page canvases for theme tweaks | Remap CSS variables in `base.css` |

---

## Auth & Permissions

- Mark admin routes with `requiresAuth` + `roles: ['admin']` via `ROUTE_PERMISSIONS`.
- Never bypass `setupPermissionGuard`.
- Compare roles using constants from `constants/permission.ts`.

---

## Markdown Feature Work

When adding BBCode tags:
1. Register handler and/or Vue component in `utils/markdown` registries.
2. Place reusable Vue pieces under `components/ui/`.
3. Keep processor plugins pure where possible.

---

## Verification Commands

```bash
pnpm --filter @applog/frontend run lint
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run build
```

---

## Common Mistakes

### Scenario: Bodyless JSON POSTs with Alova and Fastify

#### 1. Scope / Trigger

- Applies when an Alova `Post` endpoint has no domain request fields but the request adapter sends `Content-Type: application/json` to the NestJS Fastify backend.

#### 2. Signatures

- Frontend: `alovaInstance.Post<T>(path, {}, config)`.
- Backend: a `@Post()` controller method that does not require `@Body()`.

#### 3. Contracts

- Send `{}` as the JSON body. Do not pass `undefined` when the request is represented as JSON.
- Cookies and credentials remain request config, for example `{ credentials: 'include' }`; they are not body fields.

#### 4. Validation & Error Matrix

| Request | Expected result |
|---------|-----------------|
| JSON body `{}` | Fastify accepts the request and invokes the controller |
| JSON Content-Type with an empty body | Fastify rejects before the controller with `FST_ERR_CTP_EMPTY_JSON_BODY` |

#### 5. Good/Base/Bad Cases

- Good: completion or initialization POST sends `{}` and reaches the controller.
- Base: a POST with real fields sends its typed DTO normally.
- Bad: a bodyless POST passes `undefined` while the adapter declares JSON.

#### 6. Tests Required

- Assert the API owner passes `{}` for a no-field JSON POST.
- For integration coverage, assert Fastify reaches the controller rather than returning `FST_ERR_CTP_EMPTY_JSON_BODY`.

#### 7. Wrong vs Correct

```typescript
// Wrong: may produce an empty body with application/json.
alovaInstance.Post('/user/oidc/complete', undefined, config)

// Correct: valid empty JSON object.
alovaInstance.Post('/user/oidc/complete', {}, config)
```

### Mistake: Treating `useRequest` data as still wrapped

Interceptor already returns inner `data` — do not read `.data.data`.

### Mistake: Forgetting auth init on new entry points

Router guard depends on the promise from `initializeAuth()`.

### Mistake: Putting admin-only logic in public stores

Keep admin list/edit flows under `useAdminStore` / `pages/user/**`.
