# 接入 Umami 升级流量统计

## Goal

用自建 Umami 作为流量数据源，在 AppLog 中完成：前端 tracker 采集、后端代理查询、管理员 Dashboard「洞察增强」展示；停用自建 PV/UV 采集与查询。**Umami 对接参数在管理端可配置**（写入系统配置，非依赖构建期 env）。分析能力不再在 Applog 内自建。

## Background

- 现有自建 Analytics：站点/内容级 PV·UV、Dashboard 摘要/趋势/双 Top；无设备、地域等维度（归档 `.trellis/tasks/archive/2026-07/07-21-pv-uv-analytics/`）。
- 公开页「N 次浏览」仍走实体 `viewCount`，与 Dashboard 流量分离。
- Umami 不存原始 IP；地理位置来自 Geo；自建实例由用户运维，**本任务不含部署**。
- 现有 `SYSTEM_` 配置：**读取对所有人开放、写入仅 admin**（`SystemConfigService.ensureSystemKeyAccess`）。因此 **Umami 用户名/密码不能经现有公开 `getConfig` 原样下发**。

## Confirmed Decisions

| 决策 | 结论 |
|------|------|
| 分析产品 | Umami（自建，用户负责运维） |
| IP | 不要原始 IP；用国家/地区/城市 |
| AppLog 深度 | tracker + 后端代理 API + 自有 Dashboard UI |
| 自建 Analytics | 停用上报与查询；表/模块本任务不硬删；`viewCount` 不动 |
| Dashboard 块 | 摘要（今日/近 7 日 Views·Visitors）+ 近 30 天趋势 + 热门页面 Top + 设备/OS + 地理位置 |
| 热门 Top | 单栏；slug→标题映射，失败回退 path；可点前台 |
| 排除自身 | 仅 **admin** 不加载 tracker |
| API 查询凭证 | 仅后端持有并发起 Umami 请求；前端 Dashboard 只调 Applog admin API |
| **对接配置** | **管理端可配置**，落库系统配置；**不以 VITE_/backend env 为正式配置源** |
| **Tracker 引导** | **A：公开 `GET /analytics/tracker-config`**，仅返回 `{ enabled, scriptUrl, websiteId }` |

## Requirements

### R0 — 管理端 Umami 对接配置

- 在 Dashboard「系统设置」（或等价管理 UI）增加 Umami 配置表单，仅 admin 可读写完整配置。
- 配置项至少包含：`baseUrl`、`websiteId`、`username`、`password`；`scriptUrl` 可单独配置，缺省由 `baseUrl` 推导（如 `{baseUrl}/script.js`）。
- 契约进入 `@applog/common`（新 key + `IUmamiConfig` 类型）。
- **密码**：读回表单时脱敏（不回传明文）；仅当管理员提交新密码时更新存储。
- **完整配置（含凭证）禁止对非 admin 暴露**；不得依赖「SYSTEM_ 全员可读」直接返回密钥。
- 未配置或未填齐时：tracker 不加载；流量查询返回可读「未配置」错误/空态。

### R1 — Tracker 采集（frontend）

- 启动时请求公开 `GET /analytics/tracker-config`，用返回的 `scriptUrl` + `websiteId` 注入 tracker（`enabled === true` 时）。
- SPA 路由变化由 Umami 自动统计（不另写 pageview 上报）。
- 当前用户为 admin 时不加载/禁用 tracker；非 admin（含匿名）正常采集。
- 配置缺失或 `enabled === false` 时静默跳过，不影响站点可用性。
- **不**使用 `VITE_UMAMI_*` 作为正式配置源。

### R2 — 后端 Umami 代理（backend）

- 管理员只读 API：后端从**系统配置**读取 Umami 对接信息，向自建 Umami 拉取并整形后返回。
- 时区窗口按 **`Asia/Shanghai`** 计算「今日 / 近 7 日 / 近 30 日」。
- Umami 不可达或鉴权失败时返回明确业务错误，不泄露凭证。

### R3 — Dashboard 展示（frontend，仅 admin）

在现有「个人统计」摘要 + 「流量详情」tab 中改为展示：

| 块 | 内容 |
|----|------|
| 摘要 | 今日 / 近 7 日的 pageviews（Views）与 visitors |
| 趋势 | 近 30 天按日 pageviews + visitors（克制 SVG，不引入图表库） |
| 热门 | 近 30 天 path Top；标题映射 + path 回退；单栏 |
| 设备 | OS 与/或 device 分布（近 30 天） |
| 地域 | country（必要时含 city）分布（近 30 天） |

非 admin 不请求、不渲染流量 UI。

### R4 — 停用自建 Analytics 采集与查询

- 移除/停用前端 `POST /analytics/view` 上报路径（含 `useAnalyticsViewReport` / `applog_vid` 依赖）。
- 旧 summary/trend/top 不再读自建日聚合表；改为 R2 代理结果。
- 本任务不硬删 `analytics_*` 表与实体；不迁移历史自建数据到 Umami。

### R5 — 说明

- 文档/空态文案注明：Umami 实例与 Geo/`IGNORE_IP` 由运维侧完成；AppLog 只保存对接参数。

## Acceptance Criteria

- [ ] AC1：非 admin 访问公开页时，浏览器会向管理端所配 Umami 发送统计请求；admin 登录浏览时不加载 tracker
- [ ] AC2：管理员在「个人统计」看到今日与近 7 日 Views / Visitors（来自 Umami）
- [ ] AC3：管理员在「流量详情」看到近 30 天趋势、热门页面（标题或 path）、设备/OS、地理位置
- [ ] AC4：热门项在能解析 slug 时显示标题，否则显示 path；可导航到对应前台 URL
- [ ] AC5：非管理员看不到流量摘要与流量 tab，且不会调用流量查询 API
- [ ] AC6：公开页 `viewCount` /「N 次浏览」行为不变
- [ ] AC7：前端不再对已发布详情调用自建 `POST /analytics/view`
- [ ] AC8：Umami 用户名/密码不出现在前端构建产物，也不经公开 API 明文下发；管理端读回密码为脱敏态；`GET /analytics/tracker-config` 不含凭证
- [ ] AC9：Umami 未配置或服务失败时，Dashboard 流量区有可读错误/空态，站点其余功能可用
- [ ] AC10：未引入 chart.js / echarts 等图表库
- [ ] AC11：管理员可在管理端保存/更新 Umami 对接配置，保存后 tracker 与流量查询使用新配置（无需重新构建前端）
- [ ] AC12：非 admin 无法读取含凭证的完整 Umami 配置

## Out of Scope

- Umami 服务端部署、PostgreSQL、反向代理、证书、GeoIP/MaxMind 安装
- 原始 IP 查询或展示
- 历史自建 Analytics 数据迁移/对齐到 Umami
- 硬删除 `analytics_*` 表与模块（可另开清理任务）
- 来源/Referrer、UTM、实时流、Session Replay、自定义事件看板
- 热门列表强制「文章 Top / 页面 Top」双栏
- 用 Umami 回写或替换 `viewCount`
- Cookie 同意横幅
- 以 `VITE_UMAMI_*` / backend `.env` 作为正式对接配置源（管理端配置为准）

## Packages

- `@applog/common` — `SYSTEM_CONFIG_KEYS.UMAMI_CONFIG`、`IUmamiConfig`
- `@applog/frontend` — 管理端表单、tracker 引导、停用旧上报、Dashboard UI
- `@applog/backend` — 配置读写权限、公开 tracker 引导、Umami 代理、停用旧聚合查询
- 运维（用户）— 自建 Umami 实例（任务外）

## Technical Notes

- 自建 Umami 鉴权：`POST /api/auth/login` → Bearer JWT；查询用 `/api/websites/:id/stats|pageviews|metrics`。
- Metrics type：`path` / `os` / `device` / `country`（及可选 `city`）。
- 标题映射：`/archives/:slug.html` → post；`/:slug.html` → page。
- 公开引导：`GET /analytics/tracker-config` → `{ enabled, scriptUrl, websiteId }`。
- 实现后更新 analytics / system-config 相关 spec。

## Open Questions

（无阻塞项；规划已收敛。）
