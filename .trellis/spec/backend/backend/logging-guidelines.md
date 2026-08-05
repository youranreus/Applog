# Logging Guidelines

> Structured logging via `HLogger` in `@applog/backend`.

---

## Overview

- Logger module: `LoggerModule` from `@reus-able/nestjs` (global in `app.module.ts`)
- Injection token: `HLOGGER_TOKEN`
- Type: `HLogger`

Almost every service injects the logger. Known exception: `SeoService` currently has no logger.

---

## Injection Pattern

```typescript
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';

@Injectable()
export class PostService {
  constructor(
    @Inject(HLOGGER_TOKEN) private readonly logger: HLogger,
  ) {}

  private log(message: string): void {
    this.logger.log(message, PostService.name);
  }

  private warn(message: string): void {
    this.logger.warn(message, PostService.name);
  }

  private error(message: string): void {
    this.logger.error(message, PostService.name);
  }
}
```

Reference: `packages/backend/src/module/post/post.service.ts`, `packages/backend/src/module/user/user.service.ts`.

---

## What To Log

| Level | Use for |
|-------|---------|
| `log` | Operation start/success (create/update/delete, OIDC identity binding, migration stats) |
| `warn` | Suspicious but handled cases (e.g. non-admin writing `SYSTEM_` keys) |
| `error` | Unexpected failures before wrapping as `BusinessException` |

Include enough context (ids/slugs/action) but **never** log secrets (`TOKEN_SECRET`, OIDC client/session secrets, authorization codes, state, nonce, PKCE verifier, upstream tokens, passwords, raw JWT).

---

## Anti-Patterns

| Avoid | Why |
|-------|-----|
| `console.log` / `console.error` | Not used in this codebase |
| Logging without context name | Always pass `ServiceName.name` as second arg |
| Logging PII/secrets | Security risk |
| Skipping logger on new services | Follow existing service template |

---

## Verification

- New services inject `HLOGGER_TOKEN` and define private `log` / `warn` / `error` helpers.
- Catch blocks that convert unknown errors call `this.error(...)` before throwing `BusinessException`.
