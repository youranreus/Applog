# Design — 文章与页面通用评论

## Architecture and boundaries

评论目标在持久化层使用两条真实关系：

```text
CommentEntity -- postId? --> PostEntity
              -- pageId? --> PageEntity
              invariant: exactly one target
```

选择双外键是为了保留现有 `postId` 数据/API，并让 MySQL 继续负责文章或页面删除时的级联。多态 `targetType + targetId` 虽然字段更统一，但无法建立到两个表的真实外键，会把完整性和删除责任推给应用层。

## Backend contracts

- 引入 `CommentTarget = { postId: number; pageId?: never } | { pageId: number; postId?: never }` 的概念性判别模型；DTO 仍暴露兼容字段。
- 服务内部统一解析目标、生成查询条件、比较父子目标，避免在每条路径散落 `postId/pageId` 分支。
- 索引从文章专用扩展为：
  - `(postId, status, parentId)` 与 `(pageId, status, parentId)`；
  - `(postId, ip, createdAt)` 与 `(pageId, ip, createdAt)`。
- 管理 DTO 同时可带 `post` 或 `page` 摘要；前端路由工具负责投影成文章 `/archives/:slug.html` 或页面 `/:slug.html`。

## Public data flow

```text
PostDetail/PageDetail
  -> shared comment section with { type, id }
  -> generic comment composable
  -> API maps target to postId or pageId
  -> CommentService validates published target
  -> target-scoped tree/rate-limit/location queries
```

Vue component map：

- `PostDetail.vue` / `PageDetail.vue`：仅组合正文与共享评论区。
- 评论 section：接收一个显式目标，组合表单、树、状态和分页。
- 评论 composable：唯一负责请求、分页、hash 定位、capability 与回复状态。
- `CommentForm` / `CommentTree` / `CommentItem`：保持 props-down/events-up，不感知目标类型。

文章 sessionStorage key 保持 `applog:pending-comments:<postId>`；页面使用 `applog:pending-comments:page:<pageId>`，避免相同数字 ID 冲突并保留现有会话兼容。

## Typecho migration data flow

```text
typecho_comments
  JOIN typecho_contents ON comments.cid = contents.cid
  -> raw comment { cid, targetType }
  -> post/page originalId maps
  -> target-scoped topology import
  -> CommentEntity(postId | pageId)
```

- adapter 只读取目标类型，不通过 slug/title 猜测目标。
- importer 同时建立 post/page 源 ID 映射。
- 已迁移评论的目标身份用稳定的 `post:<id>` / `page:<id>` 键参与父子一致性校验。
- 未知 `contents.type` 单独计入 `commentsSkippedByTargetType`；已知类型但缺少 AppLog 映射分别计入 `commentsMissingPost` / `commentsMissingPage`。

## Compatibility and rollout

- TypeORM `synchronize: true` 会把既有 `comments.postId` 改为可空并新增 `pageId`/外键/索引；已有行的 `postId` 不变。
- 旧请求仅传 `postId`、旧公开响应读取 `postId`、旧文章 capability key 均继续有效。
- 新统计字段仅追加，不删除旧字段。
- 回滚代码前，数据库新增 `pageId` 不影响旧实体读取；但已产生页面评论的环境回滚后无法访问这些行，因此生产回滚前应先备份并确认页面评论处置。

## Risks and mitigations

- `synchronize` 在大表上执行 ALTER 可能锁表：发布前应在 Typecho/MySQL 副本与 AppLog 数据副本验证生成 DDL 和耗时。
- 双可空外键无法用当前项目约定稳定表达跨 MySQL 版本 CHECK；所有写入口和迁移测试强制 exactly-one invariant，并禁止直接 repository 写入绕过服务。
- 历史脏父子数据可能跨目标：公开祖先链与迁移拓扑都带目标校验，宁可隐藏/统计也不串目标展示。
