# 修复回复评论父目标校验错误

## Goal

修复用户在文章或独立页面下回复同一评论目标的已公开评论时，后端错误提示「父评论不属于该评论目标」的问题，同时保持跨目标回复的安全拦截。

## Background

- `CommentService.create` 在创建回复时使用 `hasTarget` 比较父评论和请求目标（`packages/backend/src/module/comment/comment.service.ts:91-98,623-629`）。
- TypeORM/MySQL 对可空的未使用目标列返回 `null`；`CommentTarget` 对该列则是缺失属性，读取值为 `undefined`。当前逐字段严格相等比较会将合法目标判为不匹配。
- 现有跨目标安全测试的实体夹具省略了可空列，得到 `undefined`，因而未覆盖真实持久化形态。
- 最小复现命令：在 `packages/backend` 下运行 `node --require ts-node/register --require tsconfig-paths/register /private/tmp/applog-comment-reply-repro.ts`；当前稳定失败并输出原始业务错误。

## Requirements

- 父评论与请求的实际目标类型和 ID 相同时，必须通过目标校验，不得因未使用的可空列是 `null` 而误拒绝。
- 文章评论和独立页面评论都必须覆盖该行为。
- 父评论属于另一文章、另一页面，或目标类型不同时，必须继续拒绝并返回「父评论不属于该评论目标」。
- 保持现有「父评论必须已公开」及其他创建评论规则不变。
- 在真实的 `null` 持久化形态上增加回归测试，且保留跨目标负例。

## Acceptance Criteria

- [ ] 回复同一文章下的已公开评论成功，即使父评论的 `pageId` 是 SQL `NULL`。
- [ ] 回复同一独立页面下的已公开评论成功，即使父评论的 `postId` 是 SQL `NULL`。
- [ ] 同数字 ID 但目标类型不同、或同类型但 ID 不同的回复仍被拒绝。
- [ ] 新增回归测试在修复前能复现原报错，修复后通过。
- [ ] 后端评论测试、后端 lint/build 及 `git diff --check` 通过。

## Out of Scope

- 不改变评论审核、限流、游客撤回凭证或通知流程。
- 不修改前端交互或 API 请求契约。
- 不清理或迁移现有评论数据；目前证据表明这是运行时值表示边界问题，不是数据关联损坏。

## Key Decisions and Risks

- 按实际目标的「类型 + ID」判定归属，避免把非目标列的 `null`/`undefined` 表示差异当成业务差异。
- 风险是过度宽松的空值归一化可能掩盖同时具有两个目标的异常数据；实现与测试应以目标类型的显式分支保持严格边界。
