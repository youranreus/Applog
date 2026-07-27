# Backend Development Guidelines

> NestJS + Fastify conventions for `@applog/backend` (`packages/backend`).

---

## Overview

Backend is a NestJS 10 app using Fastify, TypeORM + MySQL, URI versioning, and shared utilities from `@reus-able/nestjs`. Listen port: **4000**. Workspace dependency: `@applog/common`.

---

## Pre-Development Checklist

- [ ] New feature belongs in `src/module/<name>/` (controller + service + `dto/`)
- [ ] New entity goes in `src/entities/` and is added to `ENTITY_LIST`
- [ ] Protected routes use `@AuthRoles('user' | 'admin')`; public routes omit it
- [ ] Business errors use `BusinessException` (not NestJS HTTP exception classes)
- [ ] Service injects `HLogger` via `HLOGGER_TOKEN` and wraps log helpers
- [ ] Controller returns domain/DTO data; `TransformInterceptor` wraps `{ data, code, msg }`
- [ ] Cross-package system-config contracts come from `@applog/common`
- [ ] Traffic Views/Visitors uses `AnalyticsModule` Umami proxy (`GET /analytics/summary|trend|top|breakdown`) — not Post/Page `viewCount`; config via `SYSTEM_UMAMI_CONFIG`
- [ ] Visitor cursor changes follow [Visitor Cursor Cross-Layer Contract](./visitor-cursor-guidelines.md)
- [ ] Comment, moderation, pending capability, or Typecho comment migration changes follow [Comment Cross-Layer Contract](./comment-guidelines.md)

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | `src/` layout, module layout, entities | Filled |
| [Database Guidelines](./database-guidelines.md) | TypeORM entities, queries, pagination | Filled |
| [Analytics Guidelines](./analytics-guidelines.md) | PV/UV report, daily aggregates, admin APIs | Filled |
| [Weather Guidelines](./weather-guidelines.md) | Public current weather proxy, caching, failure behavior | Filled |
| [Error Handling](./error-handling.md) | `BusinessException`, validation, filters | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Naming, JSDoc, forbidden patterns | Filled |
| [Logging Guidelines](./logging-guidelines.md) | `HLogger` usage in services | Filled |
| [Visitor Cursor Guidelines](./visitor-cursor-guidelines.md) | Ephemeral presence API, lifecycle, validation, and tests | Filled |
| [Comment Guidelines](./comment-guidelines.md) | Public trees, moderation, pending capabilities, safe meme rendering, and Typecho migration | Filled |

---

## Quality Check

- [ ] No `NotFoundException` / `BadRequestException` for business errors
- [ ] No `console.log` — use `HLogger`
- [ ] No `await` mixed with `.then()`
- [ ] Controller stays thin; logic lives in service
- [ ] Input DTOs are classes with `class-validator`; response shapes are `I*` interfaces/types
- [ ] API controllers use `version: [VERSION_NEUTRAL, '1']` unless intentionally raw (e.g. SEO XML)
- [ ] Analytics: Umami proxy + Shanghai windows; never leak credentials; legacy analytics_* tables soft-disabled
- [ ] Comments: public DTOs hide private metadata; pending access requires a capability; subtree deletion is transactional

---

**Language**: English (project code comments may be Chinese).
