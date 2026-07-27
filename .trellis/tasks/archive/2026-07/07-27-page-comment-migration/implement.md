# Implementation Plan

1. 扩展评论实体、DTO、模块依赖和服务目标解析，使创建、查询、定位、限流、祖先链、管理列表对文章/页面目标一致。
2. 扩展 Typecho raw contract 与 adapter JOIN，重构评论导入为 post/page 双映射，补齐清空保护和迁移统计。
3. 将前端评论 API、composable 与 capability 存储改为显式目标输入，在页面详情复用评论区，并扩展管理端目标链接/统计文案。
4. 增补后端和前端回归测试，覆盖目标二选一、目标隔离、页面迁移、混合拓扑、管理跳转和存储 key 兼容。
5. 运行 backend unit/lint/build、frontend unit/lint/type-check/build、root build 与 `git diff --check`；修复全部失败。
6. 更新 `.trellis/spec/backend/backend/comment-guidelines.md`，执行 Trellis check、提交并归档任务。

## Validation commands

```bash
pnpm --filter @applog/backend run test:unit
pnpm --filter @applog/backend run lint
pnpm --filter @applog/backend run build
pnpm --filter @applog/frontend run test:unit
pnpm --filter @applog/frontend run lint
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run build
pnpm run build
git diff --check
```

## Risky files / rollback points

- `packages/backend/src/entities/Comment.ts`：数据库结构兼容边界；保留旧 `postId`，只做 nullable + 新增 `pageId`。
- `packages/backend/src/module/comment/comment.service.ts`：所有公开/管理查询必须使用同一目标解析逻辑。
- `packages/backend/src/module/system-config/migration.service.ts`：幂等、父子拓扑和统计必须在同一事务中保持。
- 前端 capability storage：文章 key 不迁移，页面采用新命名空间。

## Start gate

- PRD、设计与执行计划完整。
- 阻塞问题为空。
- 用户在初始请求中明确要求“生成计划后直接开始实施”，并授权确认项采用建议方案；据此按用户指示连续进入执行阶段。
