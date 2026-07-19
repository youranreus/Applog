# 阅读次数代码路径排查

## 结论（高置信度）

文章 `viewCount` 不更新，是因为 **Post 详情查询从未自增**；字段与 UI 齐全，但缺少与 Page 对等的写入逻辑。

## 证据

### Page（会更新）

`packages/backend/src/module/page/page.service.ts`：

- `findOne` / `findBySlug` 在 `page.status === 'published'` 时：
  - `page.viewCount += 1`
  - `await this.pageRepo.save(page)`

### Post（不会更新）

`packages/backend/src/module/post/post.service.ts`：

- `findOne(slug)` 查询 → 权限校验 → `return post.getData(true)`
- 无任何 `viewCount` 修改
- 全 `packages/backend` 内 `viewCount +=` 仅出现在 page.service

### 前端

- 公开详情：`usePostDetail` → `getPostBySlug` → 展示 `post.viewCount`
- 无单独「上报阅读」API

## 产品决策（已确认）

管理端 `includeUnpublished=true`（`canViewUnpublished`）访问时，**Post 与 Page 均不计数**。

## 建议修复方向

计数条件统一为：

`status === 'published' && !canViewUnpublished(user, includeUnpublished)`

- Post：`findOne` 补自增
- Page：`findOne` / `findBySlug` 收紧现有自增条件
