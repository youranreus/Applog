# Error Handling

> How `@applog/backend` represents and returns failures.

---

## Overview

Global filters from `@reus-able/nestjs` (`AllExceptionsFilter`, `HttpExceptionFilter`) normalize errors. Success responses are wrapped by `TransformInterceptor` as `{ data, code, msg }`. Controllers return plain data; do not manually wrap.

Reference: `packages/backend/src/main.ts`, `packages/backend/src/app.module.ts`.

---

## Error Types

| Type | When to use | Source |
|------|-------------|--------|
| `BusinessException` | Domain/business failures (not found, forbidden action, OIDC completion failure, etc.) | `@reus-able/nestjs` |
| Validation → `BusinessException` | DTO validation failures via global `ValidationPipe.exceptionFactory` | `app.module.ts` |

**Do not use** NestJS built-ins like `NotFoundException` / `BadRequestException` for business errors — the codebase does not use them.

---

## Service Pattern

Standard try/catch used across services (`PostService`, `CommentService`, `UserService`, `SystemConfigService`, …):

```typescript
try {
  const entity = await this.repo.findOne({ where: { slug } });
  if (!entity) {
    throw new BusinessException('文章不存在');
  }
  return entity.getData();
} catch (error) {
  if (error instanceof BusinessException) {
    throw error;
  }
  this.error(`查询文章失败: ${error.message}`);
  throw new BusinessException('查询文章失败，请稍后重试');
}
```

Rules:
1. Re-throw `BusinessException` unchanged.
2. Log unexpected errors with service `error()` helper.
3. Convert unknowns into a user-facing `BusinessException`.

---

## Validation Errors

Global `ValidationPipe` in `app.module.ts`:
- `transform: true`
- `enableImplicitConversion: true`
- `exceptionFactory` → `BusinessException('参数校验失败，请检查 ...')`

Input DTOs are classes with `class-validator` decorators and Chinese `message` strings.

Reference: `packages/backend/src/module/post/dto/create-post.dto.ts`.

---

## Controller Responses

| Case | Pattern |
|------|---------|
| Normal success | Return DTO / domain object (interceptor wraps) |
| Delete success | Often `{ message: string }` |
| SEO / sitemap | `@Res()` raw write — bypasses interceptor (`seo.controller.ts`) |

---

## Auth-Related Failures

- Missing/invalid role is handled by global `AuthGuard` + `@AuthRoles`.
- Admin checks for unpublished content / system keys use `ConfigService.get('SYSTEM_ADMIN_ROLE_VALUE', 0)` compared to JWT `role` number.

Reference: `packages/backend/src/utils/types.ts` (`mapUserRoleToJwtRole`), `SystemConfigService.ensureSystemKeyAccess`.

---

## Common Mistakes

### Mistake: Catching and swallowing BusinessException

Always re-throw so the client gets the original message.

### Mistake: Returning error payloads manually from controllers

Let filters/interceptor own the envelope. Only SEO-style raw responses are exempt.

### Mistake: Using HTTP exception classes

Prefer `throw new BusinessException('...')`.
