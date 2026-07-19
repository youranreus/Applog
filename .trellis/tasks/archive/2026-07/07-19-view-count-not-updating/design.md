# Design: 阅读次数计数规则统一

## Architecture / Boundaries

仅改后端 Post / Page 详情查询服务层；不新增 API、不改前端契约（仍从详情响应读 `viewCount`）。

```
公开详情 GET (无 includeUnpublished)
  → status=published → viewCount += 1 → save → 返回

管理端详情 GET (?includeUnpublished=true + admin)
  → 可读草稿/已发布 → 不自增 viewCount → 返回
```

## Data Flow

1. Controller 将 `query.includeUnpublished` 与当前 `user` 传入 service。
2. Service 完成存在性与发布态鉴权（沿用现有 `canViewUnpublished`）。
3. 若 `status === 'published' && !canViewUnpublished(user, includeUnpublished)`：
   - `entity.viewCount += 1`
   - `await repo.save(entity)`
4. 返回 `getData(...)`（含更新后的 `viewCount`）。

## Compatibility

- 公开读者：文章从「永不增长」变为正常增长；页面行为不变。
- 管理端编辑/预览：文章仍不增长；页面从「会增长」变为「不增长」（有意破坏旧 Page 管理端计数行为）。
- 无迁移；历史 `viewCount` 保留。

## Trade-offs

- 使用 `save` 整实体写入与 Page 现状一致；高并发下可能有轻微竞态丢失，本期不引入原子 `increment`（与现有 Page 一致，Out of Scope 去重/高并发优化）。
- 以 `canViewUnpublished` 作为「管理端路径」判定，与列表/详情鉴权语义一致，避免另造开关。

## Rollback

回退两处 service 改动即可；无 schema 变更。
