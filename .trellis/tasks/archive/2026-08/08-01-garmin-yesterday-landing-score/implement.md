# Garmin yesterday landing score — Implementation Plan

1. 更新 `@applog/common` Garmin 日状态契约，将 Today 类型和常量迁移为 Yesterday 命名，保持公开字段白名单和状态字符串不变。
2. 将后端日期工具改为返回 Garmin 本地昨日日期，并将评分纯函数改为全天目标、移除小时进度参数。
3. 将 Garmin service/controller 改为精确读取昨日行并提供 `GET /garmin/yesterday`；保持 goal precedence、null、stale、隐私和错误处理契约。
4. 更新后端测试，覆盖跨 UTC/本地午夜的昨日日期、全天稳定评分、阈值、缺失维度、精确日期查询、null/stale 和字段白名单。
5. 将前端 API、hook、Landing 组合及状态组件迁移为 Yesterday 命名，更新所有今日/截至目前/收集中等可见文案。
6. 更新前端工具和 Sprite 映射测试的共享类型引用；确认角色动作与昨日评分状态一致。
7. 确认 worker 现有测试覆盖本地今天和昨天刷新；仅在证据不足时补回归测试，不改变采集实现。
8. 更新 Garmin Trellis spec 中已过时的 today 端点、日内评分和“不得展示昨日”契约。

## Validation

- `pnpm --filter @applog/common run build`
- `pnpm --filter @applog/backend test`
- `pnpm --filter @applog/frontend test`
- `pnpm --filter @applog/backend run build`
- `pnpm --filter @applog/frontend run build`
- `pytest workers/garmin-sync/tests/test_sync.py workers/garmin-sync/tests/test_repository.py`
- 搜索确认产品代码不再引用 `/garmin/today`、`IGarminTodayStatus`、`useLandingTodayStatus` 或 `LandingTodayStatus`。
- 在桌面和移动视口检查昨日标题、指标、评分、stale、empty、loading 与 error 状态，无文本溢出或布局回归。

## Risk and rollback points

- 共享类型、后端端点和前端调用必须作为一个原子发布单元验证。
- 组件目录重命名可能影响静态测试导入路径，需同时迁移测试。
- 若部署验证失败，回滚应用代码即可；数据库和 worker 数据不需要迁移或恢复。
