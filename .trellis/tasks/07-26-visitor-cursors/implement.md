# 访客鼠标实施计划

## Implementation

1. 读取 frontend/backend 层 Trellis 规范与共享指南。
2. 先为后端访客鼠标服务编写单元测试，覆盖路径隔离、排除自身、过期清理、最近 20 位上限与 upsert。
3. 实现 NestJS DTO、内存服务、公开同步 Controller 和 Module，并接入根模块导出。
4. 实现前端类型、会话身份生成/复用、API 调用与公开路由判定。
5. 实现鼠标采集与 5 秒生命周期 composable，处理路由切换、可见性、请求重入与错误降级。
6. 实现全局鼠标展示组件，并在 `App.vue` 挂载。
7. 格式化受影响文件，运行局部测试、全量后端单元测试、前后端类型检查/构建。
8. 执行 Trellis 质量检查、评估是否需要回写 spec，并以约定式 commit 提交。

## Validation Commands

```bash
pnpm --filter @applog/backend test:unit
pnpm --filter @applog/backend build
pnpm --filter @applog/frontend type-check
pnpm --filter @applog/frontend build-only
```

## Risky Files and Rollback Points

- `packages/frontend/src/App.vue`：全局挂载点；保持组件自包含，便于一行移除。
- `packages/backend/src/app.module.ts` 与 `packages/backend/src/module/index.ts`：只添加模块导入/导出，不改动全局管道和鉴权配置。
- 不新增 TypeORM entity，因此不存在数据库回滚点。

## Review Gates

- API 仅返回同 pathname、未过期、非本人的最近 20 位访客。
- DTO 拒绝越界坐标、非 UUID 访客键、非四位十六进制 ID、非颜色值与非法 pathname。
- 高频鼠标移动不会产生高频网络请求。
- 路由离开、页面隐藏与组件卸载时正确停止定时器和事件监听。
- 展示层不阻断页面交互，且遵守减少动效偏好。
