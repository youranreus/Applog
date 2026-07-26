# 窄栏个人首页技术设计

## Architecture and Boundaries

```text
SYSTEM_BASE_CONFIG
  ├─ frontend admin SystemSettings (write)
  ├─ frontend useSystemStore (public read)
  ├─ backend WeatherService (read weatherCity)
  └─ Landing (title, subtitle, slogan, links, founded date)

Umami config → UmamiClient.getActiveVisitors()
             → GET /analytics/active (public safe DTO)
             → Landing useLandingMeta()

weatherCity → WeatherService (Open-Meteo geocoding + current weather cache)
            → GET /weather/current (public safe DTO)
            → Landing useLandingMeta()
```

## Shared Configuration Contract

扩展 `@applog/common` 的 `ISystemBaseConfig`，字段全部可选，以兼容旧 JSON：

```ts
landingTitle?: string;
landingBio?: string;
landingSlogan?: string;
weatherCity?: string;
personalHomepageUrl?: string;
bilibiliUrl?: string;
githubUrl?: string;
```

仍使用一个 `SYSTEM_BASE_CONFIG` JSON 文档，不增加新配置 key。新初始化配置与管理端表单除个人主页外默认均为空字符串；`landingTitle` 缺失或为空时使用系统标题，现有 `landingBio` 作为副标题继续使用。兼容旧配置时，副标题、Slogan、个人主页和 GitHub 的字段缺失与显式空字符串必须区分：缺失使用改造前稳定默认值，显式空字符串隐藏；个人主页缺省回退 `/about.html`。

## Public Online Contract

在现有 Analytics 模块增加：

```text
GET /analytics/active
→ { visitors: number | null }
```

`UmamiClient` 优先调用新版 `/api/realtime/{websiteId}` 并读取 `totals.visitors`；仅当新版端点返回 404 时回退 `/api/websites/{websiteId}/active`。规范化 number、`{ x }`、`{ value }`、`{ visitors }` 与新版 totals 等常见返回形态。Analytics service 使用约 15 秒内存缓存、失败负缓存与 single-flight；保存 Umami 配置时通过 generation token 失效旧请求，避免旧实例响应回写新缓存。配置缺失或请求失败由公开 service 吞并为 `null`，同时写服务端日志；不得返回或记录凭证。

## Public Weather Contract

新增 Weather 模块：

```text
GET /weather/current
→ { city: string; weather: string; temperatureC: number } | null
```

服务端读取 `weatherCity`：

1. Open-Meteo geocoding 将城市解析为经纬度；
2. forecast current 获取 `temperature_2m` 与 `weather_code`；
3. 将 WMO weather code 映射为简短中文天气；
4. 结果按标准化城市 key 缓存约 10 分钟。

第三方错误只影响天气项，公开接口返回 `null`。请求超时使用项目现有 Axios，不增加依赖。

## Frontend Data Flow

- `useSystemStore` 继续提供公开基础配置。
- `Landing/hooks/useLanding.ts` 保留最近 3 篇文章职责。
- 新增 `Landing/hooks/useLandingMeta.ts`，通过 `src/api/analytics` 与 `src/api/weather` 并行获取在线人数和天气，并复用 `getSiteUptimeText`。
- `index.vue` 负责 SEO 与区块编排；视觉组件按 Meta、Profile、RecentPosts、Slogan 拆分，避免单个 SFC 过大。
- 动态 Meta 任一请求失败时只隐藏该项；不显示技术错误，不伪造数字。

## Admin Settings

`SystemSettings.vue` 在“站点信息”下增加“个人首页”字段组：标题、副标题、Slogan、天气城市、三个 URL。`landingTitle` 留空时回退系统标题；现有 `landingBio` 作为副标题继续使用，旧数据无需迁移。使用现有 `Input`、`Field` 与统一保存按钮，不增加第二个配置请求或新 toast 路径。

## Visual Contract

- 页面 Canvas 使用 Frost；Landing 与 Footer 共用 `common-page-container` 和 flush 修饰类，在所有断点保持相同宽度与文字边缘。
- Meta 是轻量文本行，使用间距与中点分隔，不为每个指标画边框。
- 标题是页面主视觉，副标题以 17px 舒适正文承接；社交图标为 ghost link。
- 最近文章使用白色/极浅表面和 8px 圆角，可用轻微背景差异，尽量无边框、无阴影。
- Slogan 留出明显上下空白，以较安静的 Ash 文本收束。
- `ursb.me` 只贡献窄栏、直接信息与纵向节奏；颜色、字体和交互完全服从 `DESIGN.md`。

## Test Seams

根据用户此前“全部按建议”的授权，测试与验证聚焦以下公开 seam：

1. 系统配置保存/读取 round-trip 与旧配置兼容；
2. Umami active 响应规范化和公开失败降级；
3. weather code/响应规范化和公开失败降级；
4. Landing 在完整、部分缺失、加载、空、失败状态下的可见内容。

后端使用 Node 原生 test runner + `ts-node` 执行本任务的轻量单测，覆盖 Umami 响应规范化、天气码/温度规范化，以及 Umami 配置更新时的并发缓存竞态；其余页面状态以类型检查、构建、针对性 lint 和浏览器验收补足。

## Rollback

- 新配置字段为可选，回滚前端不会破坏旧配置读取。
- `/analytics/active` 与 `/weather/current` 为新增只读接口，移除不影响现有 API。
- 天气仅内存缓存，不涉及数据库迁移或持久化清理。
