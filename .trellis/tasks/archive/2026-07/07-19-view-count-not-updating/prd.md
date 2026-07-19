# 排查文章阅读次数不更新

## Goal

修复文章（Post）详情访问时 `viewCount` 不增长的问题，并统一 Post / Page 的计数规则：仅公开访问已发布内容时计数；管理端带 `includeUnpublished` 的路径不计数。

## Background

- `Post.viewCount` 字段与前端展示已存在，但 `PostService.findOne` 从未自增。
- `PageService.findOne` / `findBySlug` 已对已发布页面自增，且当前在管理端 `includeUnpublished=true` 访问已发布内容时也会计数。
- 产品决策（2026-07-19）：Post 与 Page **均**在管理端 `includeUnpublished` 路径下**不计数**。

## Requirements

- R1: 公开访问已发布文章详情时，`viewCount` 持久化 +1，并在响应中返回更新后的值。
- R2: 公开访问已发布页面详情时，保持 `viewCount` +1（行为不变，仅收紧管理端条件）。
- R3: 当请求为 admin + `includeUnpublished=true`（`canViewUnpublished` 为 true）时，Post 与 Page 详情**均不**增加 `viewCount`。
- R4: 未发布内容被拒绝公开访问时，不增加 `viewCount`。
- R5: Post / Page 计数条件保持一致，便于后续维护。

## Acceptance Criteria

- [x] AC1: 公开接口连续两次请求同一已发布文章详情，第二次 `viewCount` = 第一次 + 1，且库内一致。（→ R1）
- [x] AC2: 公开接口对已发布页面仍每次 +1。（→ R2）
- [x] AC3: admin + `includeUnpublished=true` 请求已发布文章 / 页面详情时，`viewCount` 不变。（→ R3）
- [x] AC4: 未发布文章 / 页面公开访问仍返回不存在，且 `viewCount` 不变。（→ R4）
- [x] AC5: 前端公开文章详情页展示的浏览次数随公开刷新增长。（→ R1）

> 2026-07-19：用户确认验收通过。

## Out of Scope

- IP / 用户去重、独立埋点、历史回填、统计报表。

## Technical Notes

- 改动点：`packages/backend/src/module/post/post.service.ts`（补自增）、`packages/backend/src/module/page/page.service.ts`（收紧条件）。
- 建议计数条件：`status === 'published' && !canViewUnpublished(user, includeUnpublished)`。
- 证据见 `research/view-count-codepath.md`。
