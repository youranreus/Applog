# Directory Structure

> How `@applog/backend` source is organized.

---

## Overview

Business features live under `src/module/`. Entities are centralized in `src/entities/` (not inside each module). Path alias `@/*` → `src/*`.

---

## Directory Layout

```
packages/backend/src/
├── main.ts                 # Fastify bootstrap, global interceptor/filters
├── app.module.ts           # Root module: TypeORM, AuthGuard, ValidationPipe
├── app.controller.ts
├── app.service.ts
├── entities/               # All TypeORM entities + ENTITY_LIST barrel
│   ├── index.ts
│   ├── User.ts
│   ├── Post.ts
│   ├── Comment.ts
│   ├── Page.ts
│   └── SystemConfig.ts
├── module/
│   ├── index.ts            # Re-exports *Module
│   ├── user/
│   ├── post/
│   ├── comment/
│   ├── page/
│   ├── system-config/      # May include adapters/, migration.service.ts
│   └── seo/                # Raw XML responses (bypasses TransformInterceptor)
└── utils/
    ├── const.ts            # ENV_LIST load order
    └── types.ts            # UserRole + SSO/JWT role mappers
```

Reference: `packages/backend/src/app.module.ts`, `packages/backend/src/module/index.ts`.

---

## Module Layout

Typical feature module (example: post):

```
module/post/
├── post.module.ts
├── post.controller.ts
├── post.service.ts
└── dto/
    ├── index.ts
    ├── create-post.dto.ts
    ├── update-post.dto.ts
    ├── query-post.dto.ts
    └── post-response.dto.ts
```

| Concern | Location | Example |
|---------|----------|---------|
| HTTP routes | `*.controller.ts` | `PostController` |
| Business logic | `*.service.ts` | `PostService` |
| Input validation | `dto/*` classes | `CreatePostDto` |
| Response shapes | `dto/*` interfaces/types | `IPostResponseDto` |
| Persistence model | `src/entities/` | `PostEntity` |

Reference modules:
- `packages/backend/src/module/post/`
- `packages/backend/src/module/comment/`
- `packages/backend/src/module/system-config/`

---

## File Naming

| Kind | Convention | Example |
|------|------------|---------|
| Entity file | PascalCase | `Post.ts` → `PostEntity` |
| Module/controller/service | kebab-case | `post.controller.ts` |
| DTO file | kebab-case | `create-post.dto.ts` |
| Class names | PascalCase | `PostService` |

---

## Cross-Module Dependencies

- Register entities with `TypeOrmModule.forFeature([...])` in the module that needs them.
- Export services when another module injects them (e.g. `CommentModule` exports `CommentService` for `PostModule`).
- Do not invent a custom repository layer — inject `Repository<T>` via `@InjectRepository`.

---

## Common Mistakes

### Mistake: Putting entities inside a module folder

**Wrong**: `module/post/entities/Post.ts`  
**Correct**: `src/entities/Post.ts` + add to `ENTITY_LIST` in `entities/index.ts`.

### Mistake: Fat controllers

Controllers only bind params and call services. See `packages/backend/src/module/post/post.controller.ts`.
