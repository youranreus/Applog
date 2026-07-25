# Design: 接入 Umami 升级流量统计

## Architecture

```
[Admin 系统设置] ──写入──► SystemConfig (UMAMI_CONFIG, 含凭证)
                              │
                              ├─(服务端读完整配置)──► UmamiClient ──► [自建 Umami]
                              │                         ▲
[Admin Dashboard 流量] ──/analytics/* (admin)──────────┘
                              │
                              └─(公开仅非敏感)──► GET /analytics/tracker-config
                                                     │
[访客浏览器] ◄── scriptUrl + websiteId ───────────────┘
    │ tracker (非 admin)
    ▼
[自建 Umami]
```

- **配置源**：管理端系统配置（DB），**不是** `VITE_` / `.env`。
- **采集**：浏览器 → Umami；引导信息来自公开非敏感接口。
- **查询**：Dashboard → Applog（admin）→ 读库中的凭证 → Umami → 整形。
- **旧采集**：停用；表不硬删。

## Boundaries

| 层 | 职责 | 不做 |
|----|------|------|
| System Settings UI | admin 配置 Umami 对接；密码脱敏展示 | 把密码塞进公开 getConfig |
| Frontend tracker | 拉公开引导 + 条件注入 script | 持有 username/password |
| Backend 配置读写 | 完整配置仅 admin；公开接口只返回 scriptUrl/websiteId | 对匿名回传凭证 |
| Backend `UmamiClient` | 从 DB 读配置、login/token、拉数 | 部署 Umami；存 IP |
| Dashboard 流量 UI | 摘要/趋势/Top/设备/地域 | 图表库；来源/UTM |

## Config Model（`@applog/common`）

```ts
// SYSTEM_CONFIG_KEYS.UMAMI_CONFIG → 完整 key: SYSTEM_UMAMI_CONFIG
interface IUmamiConfig {
  baseUrl: string;      // https://umami.example.com （无尾斜杠）
  websiteId: string;    // UUID
  scriptUrl?: string;   // 可选；空则 `${baseUrl}/script.js`
  username: string;
  password: string;     // 存储明文于 DB（仅服务端读）；API 读回脱敏
  enabled?: boolean;    // 可选总开关，默认 true（有齐必填项才启用）
}
```

**权限（相对现有 SYSTEM_ 全员可读的例外）**

| 接口 | 谁 | 返回 |
|------|-----|------|
| 管理端读/写完整 `UMAMI_CONFIG` | admin | 读：password 为空或 `********` 占位；写：空密码表示不修改 |
| `GET /analytics/tracker-config`（公开） | 任意 | `{ enabled, scriptUrl, websiteId }` 或未配置时 `{ enabled: false }` |
| 现有 `GET /config?key=SYSTEM_UMAMI_CONFIG` | **应对非 admin 拒绝或强制脱敏到与公开接口同等字段** | 不得明文密码 |

推荐：Umami 完整读写走 **专用 admin API**（或 system-config 对该 key 的 read 也要求 admin），避免误用通用 getConfig。

## API Contracts（Applog，建议保留 `/analytics` 前缀降低前端 churn）

`version: [VERSION_NEUTRAL, '1']`。

| Method | Path | Auth | 行为 |
|--------|------|------|------|
| `GET` | `/analytics/tracker-config` | 公开 | `{ enabled, scriptUrl, websiteId }`；未配齐则 `enabled: false`；**无凭证** |
| `GET` | `/analytics/summary` | admin | 今日 + 近 7 日 pageviews / visitors |
| `GET` | `/analytics/trend?days=30` | admin | 日序列：`[{ date, views, visitors }]` |
| `GET` | `/analytics/top?days=30&limit=10` | admin | path metrics → `{ path, title, views, href }` |
| `GET` | `/analytics/breakdown?dimension=os\|device\|country&days=30&limit=…` | admin | Umami `/metrics?type=` |
| admin | Umami 完整配置读写 | admin | 专用接口或受保护的 system-config；密码读回脱敏 |

- **废弃**：`POST /analytics/view` — 移除路由 + 删前端调用。
- 旧 `getTop(type=post|page)` 双 type 废弃，改为单栏 top。
- **已确认**：公开访客仅通过 `tracker-config` 获取引导信息（方案 A）。

### Response 形状（草案）

```ts
// summary
{ todayViews: number; todayVisitors: number; last7DaysViews: number; last7DaysVisitors: number }

// trend point
{ date: string; views: number; visitors: number } // date = YYYY-MM-DD Shanghai

// top item
{ path: string; title: string; views: number; href: string }

// breakdown item
{ name: string; value: number } // value = visitors（Umami metrics.y）
```

字段名从旧 `pv/uv` 迁到 `views/visitors`，与 Umami 语义对齐；前端文案可用「浏览 / 访客」。

## Umami Client

**配置源**：`SystemConfig` 中的 `IUmamiConfig`（管理端写入）。每次请求或短 TTL 缓存读库；保存配置后应失效 token 缓存。

**行为**

1. 校验 baseUrl / websiteId / username / password 齐备，否则「流量服务未配置」。
2. Login 取 JWT；内存缓存 token（与 websiteId/username 绑定），401 时刷新一次后重试。
3. 调用：
   - `GET .../stats?startAt&endAt`
   - `GET .../pageviews?startAt&endAt&unit=day&timezone=Asia/Shanghai`
   - `GET .../metrics?startAt&endAt&type=path|os|device|country&limit=`
4. 超时与非 2xx → `BusinessException`（不回传敏感信息）。

**时区窗口**：`Asia/Shanghai` 日历日切分 startAt/endAt。

## Path → Title 映射

| Path 模式 | 类型 | 查找 |
|-----------|------|------|
| `/archives/{slug}.html` | post | Post by slug → title |
| `/{slug}.html`（非 archives） | page | Page by slug → title |
| 其他（`/`、`/posts`…） | — | `title = path` |

`href` 直接用 path（同源前台）。删除/未找到 → title 回退 path。

## Frontend Tracker

- 启动时（auth 初始化后）请求公开 `GET /analytics/tracker-config`。
- `enabled === true` 且当前用户非 admin → 注入 `<script async data-website-id src=scriptUrl>`。
- admin 跳过；配置缺失则不注入。
- 删除 `useAnalyticsViewReport`；无引用则删 `visitor-id.ts`。
- **不**读取 `VITE_UMAMI_*`。

## Admin 配置 UI

- 放在现有「系统设置」页新增「流量分析 / Umami」分组（避免新 tab）。
- 字段：baseUrl、websiteId、scriptUrl（可选）、username、password（占位脱敏）、可选 enabled。
- 保存走 admin 专用 set 接口；成功 toast；提示「保存后无需重新构建」。

## Dashboard 流量 UI

- `PersonalStats`：摘要改 Views/Visitors。
- `TrafficStats`：趋势 + 单栏热门 + 设备/OS + 地域；去掉双 Top。
- admin-only；loading / error / empty 沿用现有气质；未配置时引导去系统设置。

## Soft-disable 旧 Analytics

| 项 | 处理 |
|----|------|
| 前端上报 | 删除调用 |
| `POST /analytics/view` | 移除或永久 no-op（推荐移除） |
| 日聚合读写 | admin GET 不再读表 |
| Entity / 表 | 保留，synchronize 不主动 drop |
| Spec | 更新 analytics-guidelines：数据源改为 Umami 代理 |

## Compatibility / Rollback

- 回滚：恢复前端上报 + 旧 service 查询；Umami 数据不丢（在 Umami 侧）。
- 自建历史 PV/UV 与 Umami **不对齐**；上线起以 Umami 为准。
- `viewCount` 全程不动。

## Risks

| 风险 | 缓解 |
|------|------|
| Umami JWT 过期 | 401 刷新重试 |
| 自建实例宕机 | Dashboard 错误态；站点可读 |
| admin 用无痕/未登录预览会计入 | 文档说明；可选运维 IGNORE_IP |
| path 规则误伤 | 仅映射已知详情模式；其余回退 path |
| 双数字（viewCount vs Umami） | UI 不混用；文案区分「终身浏览」与「站点流量」 |

## Research Refs

- [Umami Authentication](https://docs.umami.is/docs/api/authentication)（自建 login → Bearer）
- [Website statistics](https://docs.umami.is/docs/api/website-stats)（stats / pageviews / metrics）
- [Metric definitions](https://docs.umami.is/docs/metric-definitions)（不存 IP；Geo；OS/device）
