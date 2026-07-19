# Database Guidelines

> TypeORM + MySQL patterns used in `@applog/backend`.

---

## Overview

- ORM: TypeORM via `TypeOrmModule.forRootAsync` in `app.module.ts`
- DB: MySQL (`MYSQL_*` env vars)
- Schema sync: **`synchronize: true`** (no TypeORM migration files in repo)
- Entity registry: `ENTITY_LIST` from `packages/backend/src/entities/index.ts`

---

## Entity Patterns

### Local conventions

1. Class name ends with `Entity` (e.g. `PostEntity`).
2. Explicit table name via `@Entity('posts')`.
3. Relations use FK column + `@ManyToOne` / `@OneToMany` + `@JoinColumn({ name: 'xxxId' })`.
4. Cascades use `onDelete: 'CASCADE'` where children must go with parent.
5. Status fields use TypeORM `enum` column + TypeScript **union type** (avoid TS `enum`).
6. Each entity exposes a serializable shape (`XxxExportData`) and a `getData(...)` method.

Reference entities:
- `packages/backend/src/entities/Post.ts` — `PostEntity`, `PostExportData`, `getData`
- `packages/backend/src/entities/User.ts` — public `id` in `getData()` is `ssoId`, not DB PK
- `packages/backend/src/entities/Comment.ts` — self-referencing parent relation
- `packages/backend/src/entities/SystemConfig.ts` — key/value config store

### Example shape (conceptual)

```typescript
@Entity('posts')
export class PostEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ['draft', 'published', 'archived'] })
  status: PostStatus;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: UserEntity;

  getData(includeAuthor = false): PostExportData { /* ... */ }
}
```

---

## Query Patterns

| Need | Pattern | Where |
|------|---------|-------|
| Simple lookup | `repository.find` / `findOne` | Most services |
| List + joins | `createQueryBuilder` + `leftJoinAndSelect` | `PostService`, `PageService`, `CommentService` |
| Pagination | `paginate()` from `nestjs-typeorm-paginate` | `PostService.findAll` |
| Multi-step write | `DataSource.createQueryRunner()` transaction | `MigrationService` |

Reference: `packages/backend/src/module/post/post.service.ts`, `packages/backend/src/module/system-config/migration.service.ts`.

---

## Admin / Visibility Rules

Posts and similar content default to **published-only**. Admins may request unpublished via query flags (`includeUnpublished`) when JWT role matches `SYSTEM_ADMIN_ROLE_VALUE`.

Reference: `PostService.isAdmin` and `findAll` / `findOne` in `post.service.ts`.

---

## Migration Adapters (data import)

Typecho (and similar) import uses adapter interface + transaction:

- `packages/backend/src/module/system-config/adapters/migration-adapter.interface.ts` — `IMigrationAdapter`
- `packages/backend/src/module/system-config/adapters/typecho.adapter.ts` — source DB with `synchronize: false`

---

## Anti-Patterns

| Avoid | Why |
|-------|-----|
| Custom Repository subclasses | Codebase uses injected `Repository<T>` only |
| Placing entities under `module/*` | Entities are global under `src/entities/` |
| Relying on TypeORM CLI migrations | Project uses `synchronize: true` |
| Returning raw entities from controllers | Prefer `getData()` / response DTO types |

---

## Verification

- New entity registered in `ENTITY_LIST` and in any module's `forFeature([...])`.
- Relations declare FK column names explicitly.
- List endpoints that need paging use `nestjs-typeorm-paginate`.
