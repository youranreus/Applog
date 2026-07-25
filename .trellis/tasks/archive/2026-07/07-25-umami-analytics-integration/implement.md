# Implement: 接入 Umami 升级流量统计

## Checklist（建议顺序）

### 1. Common — 配置契约

- [ ] `@applog/common`：`SYSTEM_CONFIG_KEYS.UMAMI_CONFIG`、`IUmamiConfig`
- [ ] 构建 common，供前后端引用

### 2. Backend — 配置权限 + Umami 客户端

- [ ] admin 读写完整 Umami 配置（密码读回脱敏；空密码=不更新）
- [ ] 禁止非 admin 经通用 getConfig 拿到明文凭证
- [ ] 公开 `GET /analytics/tracker-config` → `{ enabled, scriptUrl, websiteId }`
- [ ] `UmamiClient`：从 SystemConfig 读配置；login/token 缓存；stats/pageviews/metrics
- [ ] 上海时区窗口工具

### 3. Backend — 改造 Analytics 查询 API

- [ ] `GET summary` / `trend` / `top` → Umami + 新 DTO（views/visitors）
- [ ] 新增 `GET breakdown`（os / device / country）
- [ ] Top：path metrics + slug 标题映射
- [ ] 移除 `POST /analytics/view` 与写入路径
- [ ] 未配置 / Umami 失败 → `BusinessException`

### 4. Frontend — 管理端配置 + Tracker + 停用旧上报

- [ ] 系统设置页增加 Umami 表单（保存后无需重建）
- [ ] 拉公开 tracker-config；非 admin 条件注入；admin 跳过
- [ ] 移除 `useAnalyticsViewReport` 等旧上报

### 5. Frontend — Dashboard 流量

- [ ] 更新 `api/analytics` 与 types
- [ ] `PersonalStats` / `TrafficStats`（单栏热门 + 设备 + 地域）
- [ ] 未配置时引导至系统设置；无新图表库

### 6. Spec / 文档

- [ ] 更新 analytics-guidelines + system-config / common 相关 spec
- [ ] 更新 frontend checklist（tracker 来源、停用旧上报）

### 7. 验证

- [ ] lint / type-check（common → backend/frontend）
- [ ] 手工：管理端保存配置 → 非 admin 产生数据 → admin 看板 → admin 不进 tracker → 非 admin 读不到密码 → viewCount 仍增

## Validation Commands

```bash
pnpm --filter @applog/backend run lint
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run lint
```

## Risky Files / Rollback Points

| 区域 | 风险 |
|------|------|
| `analytics.service.ts` / controller / dto | 行为整体切换；保留 git 可回滚 |
| `TrafficStats.vue` / `PersonalStats.vue` | UI 契约变更（pv→views） |
| 详情页上报 hook 删除 | 确认无残留调用 |
| env 未配 | 本地/预发 Dashboard 流量区失败属预期 |

回滚：恢复旧 service 读表 + 前端上报；Umami 脚本可留可去。

## Before `task.py start`

- [ ] 用户已审阅 prd / design / implement
- [ ] `implement.jsonl` / `check.jsonl` 已填真实 spec（非 seed）
- [ ] 范围确认：不含 Umami 部署
