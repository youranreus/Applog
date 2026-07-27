# Repository Evidence — Blog Comments

## Existing implementation

- `packages/backend/src/entities/Comment.ts`: AppLog comment entity already has post/author/parent relations, status, guest identity, IP, like count and timestamps.
- `packages/backend/src/module/comment/comment.controller.ts`: public create/read and admin update/delete/approve endpoints already exist.
- `packages/backend/src/module/comment/comment.service.ts`: current public list accepts arbitrary status and entity serialization exposes guest email/IP; both must be separated before public UI ships.
- `packages/frontend/src/pages/post/PostDetail.vue`: no public comment section.
- `packages/frontend/src/pages/user/CommentList.vue`: admin comment page is a placeholder.
- `packages/frontend/src/api`: no comment API module.
- `packages/common/src/types/system-config.ts`: `allowComment` exists; Dashboard copy defines it as preventing new comments, not hiding history.

## Existing migration

- `packages/backend/src/module/system-config/adapters/typecho.adapter.ts`: source database adapter supports prefix, posts and pages only.
- `packages/backend/src/module/system-config/migration.service.ts`: migrated posts store `{ migratedFrom: 'typecho', originalId: cid }` in `extra`, but rerunning the existing endpoint imports posts/pages again.
- `packages/backend/src/module/system-config/dto/migration.dto.ts`: no resource scope or comment stats today.
- `packages/backend/src/app.module.ts`: MySQL TypeORM uses `synchronize: true`.
- `packages/backend/src/main.ts`: Fastify adapter currently has no explicit `trustProxy`; real client IP behind a proxy requires deployment-specific trusted proxy configuration rather than unconditional forwarded-header trust.

## Existing frontend patterns

- `packages/frontend/src/pages/user/PostList/`: thin route view + page hook + table + shared AdminList shell.
- `packages/frontend/src/utils/alova.ts`: interceptor returns unwrapped `data`; API methods should type that value directly.
- `packages/frontend/src/utils/markdown/remark-meme-plugin.ts`: recognizes `@(xx)`, `::category:name::`, `#(xx)` with shared environment-configurable resource roots; current Markdown processor permits raw HTML and is not safe for comment text.

## Typecho primary sources

- Comment creation/status/type behavior: https://raw.githubusercontent.com/typecho/typecho/master/var/Widget/Feedback.php
- Public approved-only archive/tree behavior: https://raw.githubusercontent.com/typecho/typecho/master/var/Widget/Comments/Archive.php

Confirmed source values: types `comment` / `trackback`; statuses `approved` / `waiting` / `spam`; threaded replies use `parent`; public archive selects approved comments except the submitter's own pending cookie exception.
