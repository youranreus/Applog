# 窄栏个人首页实施计划

## Ordered Checklist

1. 加载 common、backend、frontend 与跨层 Trellis 规范，确认现有系统配置、Umami、运行时间和 Landing 数据流。
2. 更新 `ISystemBaseConfig` 与系统初始化默认值，确保旧 JSON 缺字段时兼容。
3. 以公开行为为 seam，先固定 Umami active 与天气响应的规范化/降级预期，再实现最小服务代码。
4. 在 Analytics 模块新增公开 active visitors API，复用已有凭证、token 与错误处理，加入短时缓存。
5. 新增 Weather 模块，按后台城市查询 Open-Meteo 当前天气，加入超时、中文 weather code 映射和 10 分钟缓存。
6. 扩展管理后台系统设置：简介、Slogan、天气城市、个人主页、Bilibili、GitHub。
7. 新增前端公开 API 与 `useLandingMeta`，并行读取天气与在线人数，运行时间复用 `site-uptime`。
8. 重构 Landing 为窄栏 Meta、Profile、RecentPosts、Slogan，删除旧 Hero/主题/Closing 结构和不再使用的本地配置。
9. 覆盖完整、部分配置、空文章、文章失败、天气失败、Umami 失败、长文本与链接为空状态。
10. 运行 common build、backend lint/build、frontend scoped lint/type-check/build、Impeccable detector 与 `git diff --check`。
11. 在 390px、768px、1440px 浏览器验收布局、控制台、焦点、触控尺寸与降级状态。
12. 执行 `trellis-check` 与 `code-review` 的 Standards/Spec 并行审查，修复阻塞问题后以 Conventional Commit 提交。

## Validation Commands

```bash
pnpm --filter @applog/common run build
pnpm --filter @applog/backend run lint
pnpm --filter @applog/backend run build
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run build
node .agents/skills/impeccable/scripts/detect.mjs --json packages/frontend/src/pages/Landing
git diff --check
```

如全量 lint 命中仓库既有问题，额外运行本任务文件的 scoped lint，并在交付中区分既有错误与本次改动。

## Risk and Rollback Points

- `ISystemBaseConfig`：只增加 optional 字段，避免破坏旧存量配置。
- Umami active endpoint：兼容多种返回形态；失败必须降级为 `null`，不能让公开首页 500。
- Weather external I/O：必须有超时与缓存，失败范围仅限天气单项。
- `SystemSettings.vue`：保留现有权限确认与 Umami 独立保存逻辑，新增字段仍走基础配置保存。
- Landing：保留 SEO、JSON-LD、文章接口与 `/posts` 入口；删除组件前用 `rg` 确认无目录外引用。

## Completion Record

- [x] 跨包实现完成。
- [x] 静态检查与生产构建通过；前端全量 lint 仅剩仓库既有 14 个未使用项，本任务 scoped Oxlint/ESLint 为 0。
- [x] 390px、768px、1440px 浏览器验收通过；完整态与失败/空配置态均无横向溢出。
- [x] Trellis 与 Standards/Spec 双轴代码审查完成，复核后阻塞项为 0。
- [x] Conventional Commit 已创建。

## Follow-up — 容器与标题层级

- [x] Landing 与 Footer 复用相同容器宽度及水平 padding。
- [x] 管理后台支持个人首页标题与副标题；旧 `landingBio` 无迁移兼容。
- [x] scoped lint、类型检查、构建与响应式浏览器验收通过。
- [x] Follow-up Conventional Commit 已创建。
