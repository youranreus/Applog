# 博客评论与 Typecho 数据兼容

## Goal

为当前博客补齐可运营的评论闭环，并将 Typecho 历史评论安全、可追溯、可重复地迁入 AppLog，避免历史数据丢失、重复导入或长期依赖旧表。

## Background

- 当前系统由 Typecho 迁移而来。历史评论位于 `typecho_comments`：`coid` 为主键，`cid` 关联内容，`parent` 表达回复关系，`created` 为 Unix 秒时间戳，并包含作者、邮箱、网址、IP、User-Agent、正文、类型与审核状态。
- Typecho 官方实现包含 `comment`、`trackback` 类型和 `approved`、`waiting`、`spam` 状态；公开归档默认展示 `approved`，并可只展示 `comment`。
- AppLog 已有 `comments` 实体和部分创建、查询、审核、删除服务（`packages/backend/src/entities/Comment.ts:35`、`packages/backend/src/module/comment/comment.controller.ts:26`），但公开查询会暴露敏感字段且允许读取非审核状态（`packages/backend/src/module/comment/comment.service.ts:159`、`packages/backend/src/entities/Comment.ts:141`）。
- 文章详情页没有评论 UI，前端没有评论 API 封装，管理端评论页仍为占位（`packages/frontend/src/pages/post/PostDetail.vue:78`、`packages/frontend/src/pages/user/CommentList.vue:1`）。
- 系统已有 `allowComment` 配置，但评论提交接口尚未执行该开关（`packages/common/src/types/system-config.ts:12`、`packages/backend/src/module/comment/comment.service.ts:60`）。
- 现有 Typecho 迁移只读取文章与页面（`packages/backend/src/module/system-config/adapters/migration-adapter.interface.ts:7`）。迁移后的文章将 Typecho `cid` 保存在 `posts.extra.originalId`，可用于评论关联（`packages/backend/src/module/system-config/migration.service.ts:345`）。
- 项目使用 TypeORM + MySQL 且启用 `synchronize: true`，没有 TypeORM migration 文件（`packages/backend/src/app.module.ts:29`）。

## Requirements

### R1. 公开评论阅读与发表

- 文章详情页展示该文章下已审核的顶级评论及已审核回复，并支持根评论分页。
- 游客可发表顶级评论或回复；必须填写昵称和合法邮箱，个人网站可选。
- 已登录用户直接使用账号身份，不要求填写游客身份字段。
- 游客新评论进入 `pending`，提交成功后明确提示“等待审核”；已登录用户的评论直接进入 `approved`，无需后台审核并立即公开。
- 游客提交成功后，刚提交的 `pending` 评论应在当前文章页面对该游客可见，并明确标记为“待审核”；其他访客仍不可见。
- 游客可撤回自己仍处于 `pending` 的评论；撤回授权不能仅依赖可伪造的评论 ID、邮箱、IP 或 User-Agent。
- 游客撤回使用服务端生成的一次性高熵凭证；服务端只保存凭证哈希，明文只在创建成功响应中返回一次。
- 浏览器将待审核评论引用与明文撤回凭证按文章保存在当前标签页的 `sessionStorage`。同一标签页刷新后仍可重新核验、展示和撤回；关闭标签页后本地能力失效。
- 撤回凭证只允许读取对应评论的公开安全字段并在其仍为 `pending` 时撤回；评论被通过、拒绝或删除后凭证失效。
- `allowComment = false` 时禁止新提交并显示评论已关闭，但继续展示已有已审核评论。
- 同一 IP 对同一文章 60 秒内最多提交一条评论；管理员账号不受限制，普通登录用户与游客一致。

### R2. 内容与隐私边界

- 评论正文为纯文本：保留换行，转义 HTML，不解析 Markdown、BBCode 或任意 HTML。
- 评论复用文章正文的三套表情 token 与资源配置：`@(xx)`、`::category:name::`、`#(xx)`（`packages/frontend/src/utils/markdown/remark-meme-plugin.ts:23`）。仅识别出的 token 渲染为表情图片，其余内容仍按纯文本显示。
- 邮箱、IP、User-Agent 仅管理员可见；公开 API 不得序列化这些字段。
- 新评论的 IP 与 User-Agent 必须由服务端请求上下文采集并持久化，客户端请求体不得覆盖；Typecho 历史值按源数据迁移。
- 历史 Typecho `text` 原样存储，展示时应用与新评论相同的纯文本和表情规则。

### R3. 管理员评论管理

- 管理员可分页查看所有评论（包括回复），按状态筛选并识别所属文章、父评论、评论者与创建时间。
- 管理员可将评论设为 `approved` 或 `rejected`。
- 管理员可永久删除评论及其全部后代回复。删除前必须二次确认并显示后代回复数量；取消不得产生变更。

### R4. Typecho 评论迁移

- 采用迁移方案：历史评论进入 AppLog `comments` 表，运行时不读取 `typecho_comments`。
- 迁移复用现有 Typecho 数据库连接和可配置表前缀，并支持显式资源范围；至少支持只迁评论，且只迁评论时不得修改文章或页面。
- 仅迁移 `type = 'comment'`；`trackback` 和未知类型跳过并报告。
- 状态映射为 `approved → approved`、`waiting → pending`、`spam → rejected`；未知状态跳过并报告。
- 通过 `posts.extra.originalId` 将 Typecho `cid` 映射到 AppLog `postId`。
- 保留作者显示名、邮箱、网址、IP、User-Agent、正文、创建时间、回复关系和原 `coid` 追溯信息。
- 找不到文章、父评论不存在或父评论属于其他文章时跳过，并按原因报告。
- 迁移以 Typecho `coid` 作为稳定来源标识；相同数据重复执行不得生成重复评论，既有记录计入已存在/跳过统计。
- 迁移报告至少区分：成功、已存在、非评论类型、未知状态、文章关联失败、父评论关联失败与其他失败。

## Acceptance Criteria

- [ ] AC1（R1）：访客可在文章详情页分页查看已审核评论树，提交顶级评论或回复，并获得待审核反馈。
- [ ] AC1a（R1）：游客提交后可在当前文章页面看到仅自己可见的待审核评论及状态标记，并可安全撤回；同标签页刷新后能力仍有效，关闭标签页后不再保留。
- [ ] AC1b（R1）：错误、缺失或属于其他评论的撤回凭证无法读取/撤回待审核评论；评论状态不再是 `pending` 后撤回被拒绝。
- [ ] AC2（R1）：游客缺少昵称或合法邮箱时无法提交；登录用户使用账号身份提交。
- [ ] AC3（R1）：`allowComment` 关闭后提交被拒绝且页面提示关闭，已有已审核评论仍可阅读。
- [ ] AC4（R1）：非管理员在同一 IP、同一文章 60 秒内再次提交会被拒绝，窗口结束后可提交；管理员不受限制。
- [ ] AC5（R2）：公开评论响应不包含邮箱、IP、User-Agent；除持有对应有效撤回凭证的游客外，`pending` 评论不可被普通访客读取，`rejected` 评论始终不可公开读取。
- [ ] AC5a（R2）：新评论保存服务端观测到的 IP 与 User-Agent，伪造请求体字段不会覆盖真实采集值，且两者仅在管理端可见。
- [ ] AC6（R2）：换行正确显示，HTML/Markdown/BBCode 不执行；三种既有表情 token 使用文章正文的同一资源配置渲染。
- [ ] AC7（R3）：管理员可分页查看并筛选所有状态的顶级评论与回复，并完成通过、拒绝操作。
- [ ] AC8（R3）：删除确认展示后代数量；确认后目标评论及全部后代永久删除，取消后数据不变。
- [ ] AC9（R4）：仅评论迁移不会改变既有文章/页面数量与内容，历史评论能关联到正确文章并保留作者、正文、时间、状态和回复关系。
- [ ] AC10（R4）：`trackback`、未知状态、无文章与无效父评论不会静默丢失，迁移报告按原因计数。
- [ ] AC11（R4）：相同 Typecho 源数据重复迁移不产生重复评论，并报告已存在数量。
- [ ] AC12（R1-R4）：自动化测试覆盖撤回凭证哈希与状态校验、UA/IP 服务端采集、状态映射、文章/父级关联、幂等、公开字段脱敏、审核可见性、频率限制和级联删除。
- [ ] AC13（R1）：评论分页复用文章列表的左右“上一页 / 下一页”视觉与交互，不显示当前页或页码列表；评论列表项之间不使用分割线。
- [ ] AC14（R1）：公开评论作者显示邮箱对应的 HTTPS Gravatar 头像；邮箱本身仍不得出现在公开响应或 DOM 中，登录用户已有头像时优先使用账号头像。
- [ ] AC15（R1）：评论区采用与文章阅读场景一致的克制式重设计：头像、作者、时间、正文、回复动作形成清晰层级，回复缩进响应式收敛，具备加载、空、错误、审核中及键盘焦点状态。
- [ ] AC16（R1）：当前访客持有能力凭证的待审核评论合并进正常评论树，而不是单独分区；顶级评论和回复均保持正确位置，并使用 Badge 标记“审核中”，有凭证时可撤回。
- [ ] AC17（R1）：每条评论提供稳定 `comment-<id>` anchor。带评论 hash 进入文章时，系统加载该已公开评论所在的根分页，渲染后滚动并聚焦/高亮目标；无效或不可公开目标不能泄露评论信息。
- [ ] AC18（R3）：评论管理的文章查看入口携带对应评论 anchor；已公开评论可从管理页直接跳转并定位，非公开评论不得通过公开定位接口绕过审核可见性。
- [ ] AC19（R3）：评论管理表格压缩“审核信息”和“操作”列宽；UA 截断并可查看完整值，审核动作保持紧凑且在常见桌面宽度下不抢占评论正文列。
- [ ] AC20（R1）：已登录用户提交顶级评论或回复时直接保存为 `approved`，响应不包含撤回 token，提交后立即出现在公开评论树；游客仍使用 pending 审核与 capability 撤回流程。
- [ ] AC21（R1）：评论区标题下不展示“安静地聊聊这篇文章。”或其他冗余引导文案。
- [ ] AC22（R1）：回复按钮 hover 或键盘 focus 时在按钮右侧展示当前评论 `#id`；点击后表单上方展示“正在回复 {username} #{id}”，取消回复后恢复普通提交状态。

## Out of Scope

- 评论点赞。
- 评论发表后的自助编辑。
- 邮件或站内通知。
- CAPTCHA、第三方风控或复杂反垃圾系统。
- `trackback` 的展示或管理。
- TypeORM migration 文件体系改造。
