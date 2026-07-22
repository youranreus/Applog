# Implement: 博客 PV/UV 统计与后台展示

## Checklist

### Backend

1. [ ] 新增 Analytics 实体（日聚合、日去重、去抖 hit）与 module（controller/service/dto）
2. [ ] 实现 `POST /analytics/view`（发布校验、作者排除、30 分钟去抖、上海切日、事务写聚合）
3. [ ] 实现管理员查询：`summary` / `trend` / `top`（缺日补 0；Top 联表标题）
4. [ ] 权限：上报匿名可访问；查询 `admin`（对齐项目现有 AuthRoles 用法）

### Common（按需）

5. [ ] 若前后端需要共享类型/常量，放入 `@applog/common` 并导出；否则前端本地 DTO 亦可

### Frontend

6. [ ] `visitor-id` 工具 + analytics API 模块（alova）
7. [ ] Post/Page 详情成功加载后上报（静默失败）
8. [ ] Dashboard：admin 下「个人统计」摘要四项 + 侧栏「流量详情」tab
9. [ ] `TrafficStats`：SVG 近 30 天趋势 + 文章/页面 Top 10
10. [ ] 非 admin 不渲染流量相关 UI

### Validation

11. [ ] 手动：匿名读文 → 摘要增长；30 分钟内刷新不涨；作者登录不涨
12. [ ] `pnpm --filter @applog/backend run lint`（或项目惯用检查）
13. [ ] `pnpm --filter @applog/frontend run type-check` / lint

## Suggested Order

1. 数据模型 + 上报 API（可先用 curl/HTTP 验证）
2. 查询 API
3. 前端上报接入
4. Dashboard UI

## Risky Files / Notes

- `packages/frontend/src/pages/user/Dashboard/Dashboard.vue` — tab IA，保持与现有 stats/settings 一致
- `packages/frontend/src/pages/user/Dashboard/components/PersonalStats.vue` — 勿退回彩虹 Card 墙（见 dashboard critique 归档）
- Post/Page `findOne` 路径 — **不要**为 analytics 改动 `viewCount` 逻辑
- 时区：统一用 `Asia/Shanghai` 生成 `date` 键，避免 Node 默认 UTC 切日错误

## Before `task.py start`

- [x] `prd.md` 收敛完成
- [x] `design.md` / `implement.md` 已写
- [ ] 用户确认可进入实现（或明确说「开始实现」）
- [ ] 按需填充 `implement.jsonl` / `check.jsonl` 真实 spec 条目
