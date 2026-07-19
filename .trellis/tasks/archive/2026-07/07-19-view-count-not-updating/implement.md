# Implement: 阅读次数修复

## Checklist

1. [x] 在 `PostService.findOne` 中，鉴权通过后：若 `post.status === 'published' && !canViewUnpublished(...)`，则 `viewCount += 1` 并 `save`，再返回。
2. [x] 在 `PageService.findOne` / `findBySlug` 中，将现有「仅 published 自增」改为同样条件（排除 `canViewUnpublished`）。
3. [x] 更新相关 JSDoc，标明「公开已发布访问才计数；管理端 includeUnpublished 不计数」。
4. [x] 手动或脚本验证 AC1–AC4（公开 +1、管理端不变、未发布不计数）。
   - 2026-07-19：用户确认验收通过。

## Validation

```bash
# 类型检查 / lint（按需）
pnpm --filter @applog/backend run lint

# 验证思路（需本地后端 + 已发布 slug）
# 1) 公开：GET /v1/post/:slug 两次，对比 data.viewCount
# 2) 管理：带 token + includeUnpublished=true，viewCount 不变
# 3) 页面对称验证 GET /v1/page/slug/:slug
```

## Risky files

- `packages/backend/src/module/post/post.service.ts`
- `packages/backend/src/module/page/page.service.ts`

## Before start

- [x] PRD 已收敛产品决策
- [x] design / implement 已写
- [ ] 用户确认后执行 `task.py start`
