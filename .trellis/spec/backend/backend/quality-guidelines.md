# Quality Guidelines

> Coding standards actually followed in `@applog/backend`.

---

## Overview

Match existing NestJS module patterns. Prefer conventions already visible in `post`, `comment`, `user`, and `system-config` modules over inventing new abstractions.

Also see root docs: `.cursor/rules/backend.mdc`, `CLAUDE.md`.

---

## Auth & API Surface

1. Global `AuthGuard` is always on — mark protected handlers with `@AuthRoles('user' | 'admin')`.
2. Read current user with `@UserParams() user: UserJwtPayload` (`@reus-able/types`).
3. Public endpoints omit `@AuthRoles`.
4. Controllers use `@Controller({ path, version: [VERSION_NEUTRAL, '1'] })` (exceptions: root app, SEO raw routes).
5. Return business data only; `TransformInterceptor` adds `{ data, code, msg }`.

Reference: `packages/backend/src/module/post/post.controller.ts`, `packages/backend/src/module/user/user.controller.ts`.

---

## DTO Conventions

| Kind | Form | Naming |
|------|------|--------|
| Input / query | `class` + `class-validator` | `CreatePostDto`, `QueryPostDto` |
| Response | `interface` / `type` alias | `IPostResponseDto`, `ILoginResponseDto` |
| Barrel | `dto/index.ts` re-exports | Required per module |

Notes from code:
- Update DTOs are hand-written optional fields (not `PartialType`), even though `@nestjs/mapped-types` may be installed.
- Query booleans often use `@Transform` (see `IncludeUnpublishedQueryDto`).
- Response types may alias entity export data: `export type IPostResponseDto = PostExportData`.

---

## TypeScript & Naming

- Interfaces for API contracts: `I` prefix (`IPostResponseDto`).
- Entity export interfaces often use `XxxExportData` (no `I` prefix) — keep that split.
- Prefer `type` unions + `as const` objects over TS `enum` (see `packages/backend/src/utils/types.ts`).
- Use `async/await` only — do not mix `.then()`.
- Avoid `any` unless unavoidable at a boundary.
- JSDoc on public methods (Chinese is OK and common in this repo).
- Functions should stay under ~150 lines; split when growing.

---

## Config

Env load order (`packages/backend/src/utils/const.ts` → `ENV_LIST`):

`.env.production.local` → `.env.development.local` → `.env.production` → `.env.development` → `.env`

Read via injected `ConfigService.get<T>('KEY', default)`.

Important keys: `MYSQL_*`, `SSO_*`, `TOKEN_SECRET`, `SYSTEM_CONFIG_PREFIX`, `SYSTEM_ADMIN_ROLE_VALUE`, `FRONT_URL`.

---

## Shared Package Usage

Import system-config contracts from `@applog/common`:

```typescript
import type { ISystemBaseConfig } from '@applog/common';
import { SYSTEM_CONFIG_KEYS, SYSTEM_CONFIG_PREFIX_DEFAULT } from '@applog/common';
```

Reference: `packages/backend/src/module/system-config/system-config.service.ts`.

Do not put NestJS/TypeORM code into `@applog/common`.

---

## Forbidden Patterns

| Pattern | Prefer |
|---------|--------|
| `NotFoundException` / `BadRequestException` | `BusinessException` |
| `console.log` | `HLogger` |
| `await` + `.then()` | `async/await` + `try/catch` |
| Axios / Express APIs | Fastify Nest adapter already configured |
| New Swagger decorators | Project has no OpenAPI layer today |
| Custom global guards/interceptors | Use `@reus-able/nestjs` stack |
| Entity classes inside modules | `src/entities/` |

---

## Testing Reality

There is currently **no** backend unit/e2e test tree (`nest-cli` `spec: false`). Do not assume Jest suites exist unless a task explicitly adds them.

---

## Verification Commands

```bash
pnpm --filter @applog/backend run lint
pnpm --filter @applog/backend run build
```
