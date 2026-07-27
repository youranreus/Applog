# 博客评论与 Typecho 数据兼容 — 实施计划

## Ordered Checklist

1. **建立后端回归测试骨架**
   - 为公开可见性/脱敏、身份校验、`allowComment`、60 秒频率限制、父级校验、撤回凭证、UA/IP 服务端采集、级联删除编写失败测试。
   - 为 Typecho 状态映射、文章关联、树导入、异常分类和重复执行编写失败测试。

2. **收敛评论实体与 DTO**
   - 调整正文容量、可空作者关系、游客字段容量、User-Agent、撤回凭证哈希、来源键与索引。
   - 拆分 public/admin response DTO 与 public/admin query DTO。
   - 移除客户端可写 IP/UA，补充内容长度、游客身份、pending capability 和查询参数校验。

3. **重构评论服务与路由**
   - 实现公开 approved-only 根分页 + approved 子树查询。
   - 实现系统评论开关、已发布文章校验、身份策略、请求上下文采集与频率限制。
   - 实现游客撤回 token 生成/哈希、pending 批量核验、pending-only 撤回和审核时失效。
   - 实现管理端扁平分页、状态筛选、删除影响查询、事务级联删除和审核。
   - 确保日志不包含 PII，所有业务失败走 `BusinessException`。

4. **扩展 Typecho 迁移**
   - 增加 raw comment 类型、adapter 读取和资源范围 DTO。
   - 让清理与读取步骤只处理选中资源，保持未传 resources 的旧行为。
   - 实现 Typecho 评论标准化、来源键幂等、文章映射、父子拓扑导入和分类统计。
   - 在仅评论场景证明文章/页面不被写入。

5. **建立前端评论契约与安全表情工具**
   - 新增 `types/comment.ts` 与 `api/comment/*`，Alova 返回类型按已解包数据定义。
   - 从现有 remark meme 插件抽取纯 token/URL 工具，并让文章插件继续复用。
   - 新增不使用 `v-html` 的 `CommentContent.vue`。

6. **实现文章页评论区**
   - 按 design component map 创建 `PostCommentSection`、form、tree、recursive item 和 `usePostComments`。
   - 接入分页、顶级/回复提交、登录/游客字段、待审核反馈、sessionStorage capability 恢复/清理、撤回、关闭状态、加载/错误/空态。
   - `PostDetail.vue` 仅负责挂载并传入 `post.id`。

7. **实现管理端评论页**
   - 将占位页迁移为薄组合页，新增 page hook、筛选、表格和删除确认组件。
   - 复用 AdminList shell 与 layoutStore 通知。
   - 接入通过、拒绝、删除影响查询、二次确认及刷新。

8. **全链路验证与回归**
   - 运行单测、lint、type-check 与 build。
   - 手工核对公开 API 无 PII、pending/rejected 不可见、表情/HTML 安全、移动端评论树、键盘操作和删除确认。
   - 使用小型 Typecho fixture 连续迁移两次，核对统计、文章/父级映射、幂等和文章/页面零变更。

9. **评论阅读体验增量重构**
   - 复用文章列表 `PostListPagination`，移除评论页码显示与评论项分割线。
   - 后端以规范化邮箱生成 HTTPS Gravatar，公开 DTO 只返回最终头像 URL，并补充无邮箱/账号头像优先级测试。
   - 重构 `CommentItem` 的头像、元信息、正文、动作、递归缩进、响应式与焦点状态；不引入卡片阴影或 raw HTML。
   - 将自有 pending 根评论/回复合并到正常评论树，以 Badge 表示“审核中”，保留凭证控制的撤回入口并保证去重。
   - 增加 approved-only comment location API、稳定 `comment-<id>` anchor、hash 解析、目标分页加载、渲染后滚动/聚焦与 reduced-motion 处理。
   - 管理列表的查看链接携带 comment hash；压缩审核信息和操作列，UA 省略但保留完整可访问信息。
   - 覆盖 Gravatar、location 页码/祖先可见性、pending 树合并、anchor 跳转和管理链接回归。

10. **登录直发与回复上下文细化**
   - 评论创建按身份决定初始状态：登录用户 `approved` 且无 token，游客 `pending` 且保留 capability；补充服务测试。
   - 前端按创建响应状态分流：approved 重新加载正确公开树，pending 才写 storage 并合并待审核树。
   - 去除评论区副标题；回复按钮在 hover/focus 显示 `#id`，表单展示“正在回复 {username} #{id}”，补充组件/前端回归。

## Validation Commands

```bash
pnpm --filter @applog/backend run test:unit
pnpm --filter @applog/backend run lint
pnpm --filter @applog/backend run build
pnpm --filter @applog/frontend run lint
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run build
pnpm run build
```

## Review Gates

- Public controller/service cannot accept caller-selected status and cannot serialize mail/IP/agent/source fields.
- Public comment creation cannot trust body IP/User-Agent and cannot comment on unpublished posts.
- Plain withdrawal tokens never enter database storage, URL parameters, logs, admin DTOs or error messages; hash comparison and pending-state checks are authoritative.
- Pending resolve is bounded and capability-based, and merging it into the current page cannot expose another visitor's pending comment.
- Comment content path contains no `v-html` and does not call the raw-HTML Markdown processor.
- Migration source key has a database unique constraint and application-level existing-row handling.
- Comments-only migration issues no post/page writes; source anomalies appear in returned stats/log summary.
- Delete dialog fetches current impact immediately before confirmation; service transaction remains authoritative.
- Gravatar URL is produced server-side without exposing the source email; account avatars win when present.
- Comment location uses the same approved-root ordering and page size as the public list and reveals no hidden-status distinction.
- Pending comments are merged only from validated capabilities, never from caller-supplied comment data or ids alone.
- Comment pagination reuses the article-list control and renders no numeric page indicator; comment items render no separator rule.
- Authenticated creation must persist `approved` without a withdrawal token; guest creation remains `pending` with a hashed capability.
- Reply context always carries both author display name and comment id; the id is visually disclosed on reply-action hover/focus without becoming hover-only accessibility information.

## Risky Files and Rollback Points

- `packages/backend/src/entities/Comment.ts`: schema synchronization can execute DDL; verify against a database copy before deployment.
- `packages/backend/src/module/comment/comment.service.ts`: current public/admin paths are mixed; land DTO and route separation with tests in the same change.
- `packages/backend/src/module/system-config/migration.service.ts`: existing method is large and batch-oriented; extract comment import helpers instead of extending one oversized function.
- `packages/frontend/src/utils/markdown/remark-meme-plugin.ts`: preserve article rendering through shared pure utilities and regression/build checks.
- `packages/frontend/src/pages/post/PostDetail.vue`: keep the article rendering path unchanged except for mounting the comment section.

If execution reveals that existing production schema cannot be synchronized safely, stop before deployment and return to planning for an explicit migration/DDL rollout; do not improvise destructive SQL.

## Pre-start Checks

- PRD, design and implementation plan approved by the user.
- `implement.jsonl` and `check.jsonl` contain real spec/research entries.
- Working tree has many pre-existing user changes; implementation must preserve and not revert unrelated edits.
- Before editing, load Trellis Phase 2 context and the required Vue/Trellis implementation skills.
