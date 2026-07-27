# 扩展页面评论迁移

## Goal

让 AppLog 的评论完整支持文章与独立页面，并让 Typecho 评论迁移按照 `comments.cid -> contents.cid` 的真实关系，将评论导入对应的文章或页面。现有文章评论、评论审核、游客待审核 capability 与 comments-only 迁移行为必须保持兼容。

## Background

- 当前 `CommentEntity` 只有非空 `postId`，公开评论 API、限流、父子校验、管理列表和前端评论区均以文章为唯一目标。
- Typecho 的评论表只保存 `cid`；目标类型来自同一个 `contents` 表的 `type` 字段，可能是 `post` 或 `page`。
- AppLog 已分别迁移 Typecho 文章和页面，并在两者的 `extra` 中保存 `migratedFrom: 'typecho'` 与 `originalId`，可作为评论目标映射键。
- 项目使用 TypeORM `synchronize: true`，没有独立 migration 文件；实体变更即为现有数据库的结构升级入口。

## Requirements

### R1 — 评论目标模型

- 评论必须且只能关联一个已发布目标：文章或页面。
- 保留现有 `postId` 字段和文章评论请求兼容性；新增可空 `pageId` 及页面关系。
- `postId` 与 `pageId` 在实体中均可空，但所有创建与迁移写入必须满足恰有一个非空。
- 删除文章或页面时，其评论继续通过数据库外键级联删除。
- 父评论必须属于同一目标且已公开；公开树、定位、限流及祖先链校验均按完整目标隔离。

### R2 — 公开与管理 API

- 创建、列表查询接受 `postId` 或 `pageId`，拒绝两者同时缺失或同时出现。
- 现有只传 `postId` 的客户端行为不变。
- 公开 DTO 返回所属目标标识，不暴露新的隐私字段。
- 管理列表同时关联文章和页面，并能链接到正确公开详情页；仅 approved 评论附带锚点。
- 现有审核、回复树、撤回、点赞、删除影响与分页语义对两类目标一致。

### R3 — 前端页面评论

- 页面详情在正文后展示与文章一致的评论区，受全局 `allowComment` 控制。
- 文章与页面复用同一套评论组件、composable、API 和树逻辑，不复制业务实现。
- 游客待审核 capability 按目标隔离；文章沿用既有 sessionStorage key 以避免兼容性回退，页面使用独立 key。
- hash 定位、分页、回复、撤回、审核中展示在页面评论中与文章一致。

### R4 — Typecho 迁移

- Typecho adapter 查询评论时联结 `contents`，带回目标内容类型。
- `contents.type = post` 的评论映射到 `PostEntity.extra.originalId`；`page` 映射到 `PageEntity.extra.originalId`。
- 仅导入 Typecho `comments.type = comment` 且状态受支持的记录。
- 父子拓扑必须保持在同一目标内；迁移重跑继续由 `(source, sourceId)` 幂等。
- 统计需区分缺少文章、缺少页面与不支持的目标类型；管理端迁移结果同步展示。
- comments-only 源数据读取仍不得触发 Typecho 文章/页面抓取，也不得清空 AppLog 内容。
- 清空页面时若存在页面评论且未同时选择 comments，必须像文章一样拒绝隐式级联丢失。

### R5 — 兼容、安全与质量

- 延续既有评论隐私、capability、安全渲染、稳定排序和事务删除契约。
- 不新增 TypeScript `any`、不使用 `v-html` 渲染评论。
- 更新跨层评论规范，使目标模型、Typecho 映射和测试要求与实现一致。
- 后端单测、构建/lint，前端单测、type-check/build/lint，根构建和 `git diff --check` 通过。

## Acceptance Criteria

1. 对已发布页面可创建根评论和回复；未发布/不存在页面被拒绝，跨文章/页面回复被拒绝。
2. 同一数值 ID 的文章与页面评论不会串读、串限流、串定位或串 capability。
3. 现有文章评论 API 和已有文章待审核 sessionStorage capability 继续工作。
4. 页面详情可完整展示评论树、分页、提交、回复、撤回与 hash 定位。
5. 管理端评论列表同时显示并正确跳转文章或页面目标。
6. Typecho post/page 评论按 `contents.type` 进入对应实体，父子关系、时间、状态和幂等键保持；缺失/不支持项进入独立统计。
7. 页面带评论时，`clearExisting + pages` 且未选择 comments 会被拒绝。
8. 自动化测试覆盖页面评论目标隔离、页面迁移、混合拓扑、幂等、统计和前端目标路由/存储。

## Out of Scope

- 为每篇文章或页面新增独立的“允许评论”开关；本次继续使用全局 `allowComment`。
- 改变评论审核策略、富文本/Markdown 渲染、点赞语义或分页排序。
- 引入 TypeORM CLI migration 文件或关闭现有 `synchronize: true`。
- 迁移 Typecho trackback/ping 等非 `comment` 类型反馈。

## Technical Notes

- 采用双可空外键 `postId` / `pageId`，而非无外键的 `targetType + targetId` 多态列。
- Typecho 官方 MySQL schema 与反馈实现证据记录于 `research/typecho-comment-targets.md`。
- 阻塞问题：无。用户已明确授权对讨论中的确认采用建议方案，并要求计划后直接实施。
