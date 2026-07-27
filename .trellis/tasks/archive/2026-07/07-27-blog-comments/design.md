# 博客评论与 Typecho 数据兼容 — 技术设计

## Architecture and Boundaries

该功能保持现有 NestJS + TypeORM + Vue/Alova 分层，不引入第二套评论模型：

```text
Typecho comments ──adapter──> migration normalization ──transaction──> comments
                                                                      │
Public article ──Alova──> public comment API ──visibility policy───────┤
Admin page ─────Alova──> admin comment API ──moderation policy─────────┘
```

- `CommentEntity` 是迁移后与新评论的唯一运行时来源。
- 控制器只做认证、DTO、IP/User-Agent 提取；可见性、限流、树构造、审核与迁移规则属于 service。
- 公开 DTO 与管理 DTO 分离，实体的敏感字段不能通过通用 `getData()` 意外泄露。
- 前端 SFC 只通过 `api/comment/*` 和 page composable 访问数据；不在页面内直接调用 Alova。

## Data Model

在现有 `CommentEntity` 上收敛以下契约：

- `content`: `mediumtext`，原样存储纯文本与表情 token。
- `status`: 保持 `pending | approved | rejected`。
- `postId`: 必填，删除文章时级联删除评论。
- `parentId`: 可空，自关联；删除父评论时级联删除全部后代。
- `authorId`: 改为可空；登录用户关联 AppLog 用户，游客和 Typecho 历史评论不伪造本地用户关系。用户删除时使用 `SET NULL`，不级联删除评论。
- `guestName` / `guestEmail` / `guestSite`: 保存游客及 Typecho 历史作者信息；列容量至少覆盖 Typecho 的 200 字符约束。
- `ip`: 可空、最长 64；仅管理端使用。
- `agent`: 新增可空字段，覆盖 Typecho `agent` 的 200 字符约束。
- `withdrawTokenHash`: 新增可空、不可公开字段；仅游客 `pending` 评论需要。保存高熵撤回凭证的单向摘要，不保存或记录明文。
- `source` + `sourceId`: 新增可空来源键；Typecho 评论写为 `typecho` + `coid`，建立唯一组合索引以保证幂等。原生评论两列为空。
- `extra`: 保留扩展用途；Typecho `authorId`、`ownerId` 等不参与运行时身份的源字段可放入追溯元数据。
- 为 `postId`、`parentId`、`status`、`createdAt` 及频率限制查询所需组合建立索引。

项目继续使用 `synchronize: true`，不在本任务引入 TypeORM migration 文件体系。

## API Contracts

### Public API

- `GET /comment?postId=<id>&page=<n>&limit=<n>`
  - `postId` 必填。
  - 只分页查询 `approved` 顶级评论，再递归附加 `approved` 后代；挂在非公开父级下的评论不会越级展示。
  - 返回公开 DTO：正文、公开作者显示信息、父级、状态（恒为 approved）、时间、回复；不含邮箱、IP、User-Agent、来源内部字段。
- `POST /comment`
  - 输入：`content`、`postId`、可选 `parentId`、游客身份字段。
  - IP 与 User-Agent 只从服务器请求上下文获取，客户端不能提交/覆盖。IP 使用 Fastify/Nest 的请求解析结果，不直接信任请求体或手工解析任意转发头。
  - 校验文章已发布、父评论存在且属于同一文章、`allowComment`、身份规则与 60 秒频率限制。
  - 游客新记录状态为 `pending`，生成至少 256 bit 的随机撤回凭证，只保存哈希，并在本次成功响应中返回一次明文 token。
  - 已登录用户新记录状态为 `approved`，不生成撤回凭证；仍执行文章、父级、评论开关和非管理员 60 秒频率校验。
- `POST /comment/pending/resolve`
  - 输入数量受限的 `{ commentId, token }[]`，逐项执行哈希比对。
  - 只返回仍为 `pending` 且凭证匹配的公开安全 DTO；不返回敏感字段，不允许按邮箱、IP 或 UA 枚举。
- `POST /comment/:id/withdraw`
  - 输入撤回 token；仅当哈希匹配且状态仍为 `pending` 时永久删除该评论。
  - 使用统一、非枚举式失败信息，token 不写入 URL 或日志。
- 现有公开单条详情若保留，只能返回 `approved` 且使用公开 DTO；不得成为绕过列表可见性规则的入口。
- `GET /comment/:id/location?limit=<n>`：仅为完整祖先链均为 `approved` 的评论返回其根评论所在页和根评论 ID；页码算法必须与公开根评论 `createdAt DESC` 排序一致。用于带 `#comment-<id>` 的文章入口先加载正确分页，不能暴露 pending/rejected 的存在。

### Admin API

- `GET /comment/admin?page=&limit=&status=&postId=`：扁平分页返回全部评论和回复，包含所属文章摘要、父评论 ID、敏感审核信息与后代数量。
- `POST /comment/:id/approve`：仅允许 `approved | rejected`。
- `GET /comment/admin/:id/delete-impact`：返回当前后代数量，供确认框展示。
- `DELETE /comment/:id`：在事务内删除目标及所有后代，返回实际删除数量。
- 现有更新正文和点赞接口不属于 MVP；不在新 UI 暴露，点赞行为可保留兼容但不扩展。

所有管理端点使用 `@AuthRoles('admin')`。业务错误使用 `BusinessException`，响应仍由全局 interceptor 包装。

管理员将评论改为 `approved` 或 `rejected` 时清空 `withdrawTokenHash`，游客不能在审核后撤回。管理端删除仍遵循整棵子树规则。

## Public Comment Policy

1. 公开读取永远由服务端强制 `approved`，不接受客户端状态筛选。
2. 游客必须提供昵称和邮箱，网站可选；登录用户只使用账号身份。
3. `allowComment = false` 只阻断写入，不阻断已审核历史读取。
4. 非管理员按 `(postId, ip, createdAt >= now - 60s)` 检查频率，所有审核状态均计入窗口。
5. 日志只记录评论/文章 ID 和操作结果，不记录邮箱、IP、User-Agent 或正文。
6. IP 以应用实际观测值为准；当前 Fastify 未配置 `trustProxy`（`packages/backend/src/main.ts:15`）。若生产位于反向代理后，应使用部署环境明确的可信代理配置，不能无条件信任任意 `X-Forwarded-For`。

## Safe Text and Meme Rendering

不能把评论送入当前允许 raw HTML 的 Markdown 渲染链，也不能对用户输入使用 `v-html`。

- 从现有 `remark-meme-plugin.ts` 提取纯函数作为唯一 token 规则来源：识别三种语法、生成资源 URL、输出类型化片段。
- 文章的 remark 插件复用该纯函数，保持现有文章行为不变。
- `CommentContent.vue` 遍历 `{ type: 'text' | 'meme' }` 片段：文本使用 Vue 插值与 `white-space: pre-wrap`，表情使用受控 `<img>` 属性。
- 未识别或资源异常的 token 保留原文/alt，不执行任意 HTML。

## Comment Identity, Gravatar and Anchors

- 后端负责生成头像地址，前端不接收邮箱再自行散列。规范化邮箱使用 `trim().toLowerCase()`，生成 HTTPS Gravatar URL；摘要仅作为 Gravatar 标识，不替代撤回凭证的 SHA-256 安全规则。
- 登录用户优先使用账号头像；账号头像为空时使用账号邮箱 Gravatar。游客和 Typecho 历史评论使用 `guestEmail` Gravatar。公开 DTO 只返回最终 `author.avatar`，绝不返回邮箱。
- 每个 `CommentItem` 根元素使用 `id="comment-${comment.id}"`，并提供可键盘聚焦的目标语义。路由 hash 是唯一公开定位输入，不把待审核 capability 放入 URL。
- 文章评论 composable 解析 `#comment-<positive id>`：先请求公开 location，再切到目标根分页；DOM 更新后滚动到 anchor，并使用短暂、尊重 reduced-motion 的目标强调。失败时正常展示评论区，不区分不存在与未公开。
- 管理表格对 approved 评论的“查看页面”链接使用文章 URL + comment hash。pending/rejected 仍可进入文章，但不能通过公开接口定位或显示该评论，以保持审核边界。

## Visual Direction

评论区继承既有文章页的 **Read** 模式与 Apple 式克制视觉，不建立新的品牌世界：白/浅灰阅读画布、Carbon 主文字、Ash 次级信息、蓝色只用于明确动作。

- 评论是开放的对话流，不使用卡片墙、阴影或逐项分割线。层级来自头像对齐、留白、字号和回复缩进。
- 单条评论采用头像列 + 内容列：作者与时间在同一紧凑元信息行，正文保持舒适行高，回复/撤回作为低强调文字动作。
- 待审核评论与普通评论使用完全相同的布局，只增加小型 `Badge`“审核中”；pending 根评论合并到当前根列表，pending 回复挂到已加载父评论下。已登录用户提交成功后刷新公开树，不进入 capability/pending 合并路径。
- 评论标题直接使用“评论”，不附加情绪化副标题。
- 回复动作默认只显示“回复”；hover 与 `:focus-visible` 时在右侧显露 `#<commentId>`，不得造成按钮布局明显跳动。表单 reply context 使用“正在回复 <authorName> #<commentId>”，取消按钮保持键盘可达。
- 顶级评论间以垂直留白分组；递归回复用缩进和更紧凑节奏表达关系，不使用横线。
- 分页直接复用 `PostListPagination.vue`，只显示左右上一页/下一页，不显示页码。
- 移动端缩小头像与回复缩进，保证正文宽度；交互目标、焦点环、加载/禁用状态保持清晰。

## Vue Component Map

### Public article comments

| Component / composable | Single responsibility | Contract |
|---|---|---|
| `PostDetail.vue` | 文章详情组合层 | 将 `post.id` 传给评论区 |
| `PostCommentSection.vue` | 组合加载态、评论树、分页和表单 | props: `postId`; 监听提交/回复后刷新 |
| `CommentForm.vue` | 顶级/回复表单与本地校验 | props: reply target、disabled、identity mode；emit: submit/cancel |
| `CommentTree.vue` | 渲染根评论集合与空态 | props: comments；emit: reply |
| `CommentItem.vue` | 单条评论及递归回复 | props down，reply event up，稳定 ID key |
| `CommentContent.vue` | 安全纯文本 + 表情片段渲染 | props: content；无 `v-html` |
| `usePostComments.ts` | Alova 请求、分页、提交、回复目标、pending capability 协调和通知 | 返回只读状态与显式 actions |

增量边界：

- `PostListPagination.vue` 保持文章列表与评论区的单一分页视觉来源；评论区传入当前页、总页数与换页 action。
- `CommentItem.vue` 同时负责稳定 anchor、头像呈现、状态 Badge 和目标强调所需语义，不自行读取路由或请求数据。
- `usePostComments.ts` 负责把自有 pending 评论无重复地合并进已批准树，并协调 hash location → page load → DOM 定位；渲染组件不直接操作 sessionStorage。

`usePostComments.ts` 将 `{ commentId, token }` 按 `postId` 保存在 `sessionStorage`。初始化或刷新时调用 pending resolve，并将核验后的自有待审核评论合并进正常评论树；已失效 token 从 storage 清理。撤回成功后立即移除本地条目。storage 访问封装为纯工具并处理不可用或损坏数据，不把 token 放进 Pinia、URL、错误文案或日志。已登录用户提交成功后不写 capability storage，而是重新加载公开评论页并展示 approved 结果。

### Admin moderation

| Component / composable | Single responsibility | Contract |
|---|---|---|
| `CommentList.vue` | 管理页组合层 | 组合 header/filter/table/pagination/dialog |
| `CommentFilters.vue` | 状态筛选 | props: status/loading；emit: change |
| `CommentTable.vue` | 扁平评论列表与审核操作入口 | props: items/loading；emit: approve/reject/delete |
| `CommentDeleteDialog.vue` | 获取影响范围并二次确认 | props: target/impact/loading；emit: confirm/cancel |
| `useCommentList.ts` | 管理查询、筛选、审核、删除与通知 | 返回只读状态与显式 actions |

管理页复用 `AdminListHeader`、`AdminListError`、`AdminListEmpty`、`AdminPagination` 与现有 shadcn primitives。无需新增全局 Pinia 状态。

`CommentTable.vue` 将文章标题与独立“查看页面”锚点入口放在同一紧凑区域；审核信息列设定窄宽，IP 与状态纵向排布，UA 单行省略并通过 `title`/可访问文本提供完整值；操作列使用紧凑按钮组并避免换成宽卡片操作区。

## Typecho Migration

### Request shape

为 `MigrateDataDto` 增加显式 `resources`（`posts | pages | comments`）。为兼容现有调用，未提供时保持当前 `posts + pages` 行为；补迁评论显式传 `['comments']`。

`clearExisting` 只作用于所选资源，且仍需管理员显式传入。评论补迁的正常路径依靠幂等键，不需要清空。

### Source and normalization

- `IMigrationAdapter` 增加 `fetchComments()`，Typecho adapter 使用表前缀读取所有评论并按 `coid` 升序返回。
- 先执行类型、状态、文章映射校验，建立 `cid → postId`。
- Typecho 评论全部以历史游客身份导入：显示名/邮箱/网站按源数据保留，`authorId = null`；避免将 Typecho 用户 ID 错绑到 AppLog SSO 用户。
- `createdAt` 与 `updatedAt` 由 `created * 1000` 构造；正文不做 HTML/Markdown 转换。

### Idempotent tree import

1. 在事务开始时加载已有 `(source='typecho', sourceId)`，计入 `alreadyExists` 并加入 `coid → commentId` 映射，供其后代复用。
2. 导入根评论并记录新 ID。
3. 迭代导入父级已映射的子评论，直到无进展。
4. 剩余记录按父评论缺失/跨文章分类跳过。
5. 唯一索引作为并发/重复执行的最终防线。
6. 事务失败回滚本次评论写入；源数据库连接在 finally 中关闭。

迁移统计扩展为 commentsImported、commentsExisting、commentsSkippedByType、commentsSkippedByStatus、commentsMissingPost、commentsMissingParent、commentsFailed，并保留文章/页面既有统计字段。

## Operational and Rollback Considerations

- 上线前先备份 AppLog MySQL；评论补迁默认只读 Typecho、只写 comments。
- 首次执行建议先在副本数据库验证迁移报告与抽样树结构，再在生产执行 `resources=['comments']`。
- 功能回滚可撤回 API/UI 代码；已迁评论通过 `source='typecho'` 可精确识别。删除迁移数据属于破坏性操作，不由应用自动执行。
- `synchronize: true` 的列变更在应用启动时发生，部署前必须验证数据库用户具备对应 DDL 权限。

## Key Trade-offs

- 迁入统一表而非运行时兼容旧表：多一次迁移工作，换取单一评论模型。
- 公开/管理 DTO 分离：增加类型数量，换取可验证的隐私边界。
- 来源键列而非仅 JSON `extra`：增加两列和索引，换取可靠幂等查询与唯一约束。
- 纯文本 token 化而非 Markdown 渲染：减少格式能力，避免评论 XSS 面。
- 父评论硬删除整棵子树：数据不可恢复，但语义清晰且不产生孤儿节点。
