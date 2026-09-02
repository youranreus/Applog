# Landing AI Cost 数据源切换到 Tokscale

Status: planning
Created: 2026-09-02

## Goal

Landing 页「AI Cost / 开发状态」区块的数据源从 WakaTime 换成 Tokscale，同时把展示口径从「最近 30 天的 token 概览」改为「过去一天的 token 明细 + 软件 × 模型二维列表」。

用户价值：这块从「采集有问题、看不出所以然的 30 天汇总」变成「今天用了哪些 AI 软件、跑了哪些模型、各自烧了多少 token 和钱」——具体、可信、可读。

## Background

### 现状（WakaTime）

数据流：`WakaTimeClient.getSummaries()` → `buildWakaTimeLandingStats()` → 进程内快照 → `GET /wakatime/stats` → `useLandingWakaTimeStats` → `LandingWakaTimeStats.vue` → `WakaTimeUsageCard.vue`。

现有卡片渲染：周期行「最近 30 天 · 日期范围」、hero（总 token + `~$X.XX`）、Input/Cached Input/Output 三段分布条 + legend、两列 pill breakdown（工作环境 / AI 模型）。后端 DTO 里的 `summary30Days` / `summary7Days` / `days[]` / `languages[]` / `ai.changeShare` / `ai.sessions` 已计算但从未展示。

需保留的架构模式（与 Duolingo / Garmin 一致）：浏览器永不直连上游；公开 API 只返回白名单快照且同步读取不触发上游；成功 TTL + 失败抑制 + single-flight + generation 竞态防护；stale-while-revalidate；快照为 `null` 时 Landing 整段隐藏、不影响其他区块。

### 目标数据源（Tokscale）

完整调研见 [`research/tokscale-api.md`](research/tokscale-api.md)。

- **只用 `GET https://tokscale.ai/api/users/{username}?period=month`**。公开只读、无需凭证，上游自带 60s revalidate。实测 payload 39KB。
- **`GET /api/me/stats` 已排除**：只有日级 `tokens / inputTokens / outputTokens / cost`，缺 cache read、缺软件维度、缺模型维度，且需要 Bearer personal token。其源码注释写明它是给 CLI TUI 用的跨设备汇总接口。
- 需求要的全部字段都在 `contributions[]` 里，无需派生估算：
  - 日级 `totals.tokens` / `totals.cost` / `tokenBreakdown.{input, output, cacheRead, cacheWrite, reasoning}`
  - 软件级 `clients[].client`（id）/ `clients[].cost` / `clients[].tokens.*`
  - 模型级 `clients[].models[modelId].{tokens, cost, input, output, cacheRead, cacheWrite, reasoning}`
- 已在真实数据上验证的恒等式：`totals.tokens == tokenBreakdown 五项之和`；某软件下所有 model 之和 == 该软件的 `tokens.*` / `cost`。因此前端可直接展示，无需对账。
- 目标账号 username = `youranreus`（取自本机 `~/.config/tokscale/credentials.json`）。
- 本机 autosubmit 每 120 分钟一次，所以「今天」是滚动更新、进行中的数据。
- 日期桶按**提交机器本地时区**分（本机 `Asia/Shanghai`），服务端无法覆盖 → Applog 配置不需要 timeZone 字段。
- 软件返回的是 id（`pi` / `hermes` / `cursor`），展示名表 `SOURCE_DISPLAY_NAMES` 不通过接口暴露，需在 Applog 侧内置。
- `contributions[].clients[].models` **不过滤** `<synthetic>` 伪模型（上游只在 `modelUsage` 里过滤），需自行过滤。
- `contributions[].totals.messages` 恒为 0，不可用。
- 上游无 schemaVersion，无法程序化检测 breaking change，只能靠 fixture 契约测试。

## Key Decisions

- **D1 替换范围**：彻底删除 WakaTime 全栈代码，Tokscale 完全接管。范围见 [`design.md` §8](design.md)。顺带去掉整套 apiKey 脱敏逻辑——Tokscale 不需要任何密钥。
- **D2 展示哪一天**：取 `contributions` 中最后一个有数据的自然日（通常是进行中的今天，今天无数据则自动退到更早的一天），卡片上标出该日期。接受同一天内多次刷新数字会变大。
- **D2b 数据陈旧时的表现**：不因数据新旧隐藏区块，只在数据日期距今超过 3 天时挂「数据更新延迟」提示。与现有 WakaTime / Duolingo / Garmin 三块的统一做法一致（只在拿不到数据时整段隐藏）。
- **D3 顶部指标构成**：总 token 之外列出 input / output / cacheRead / cacheWrite / reasoning 五项，保证分布条与 legend 恒能汇成 100%。某项为 0 时 UI 上自动隐藏（DTO 仍返回 0，隐藏是前端行为）。
- **D4 列表展示范围**：软件全量、模型全量，软件按 cost 降序、组内模型按 cost 降序。不做 Top N 截断，不做折叠。
- **D5 配置形态**：不建专用 config key，改为在 `ISystemBaseConfig` 增加 `tokscaleUsername?: string`，沿用 `weatherCity` 的模式（trim 后非空即启用），管理入口并入 `LandingSettingsFields.vue`。
- **D6 上游 period**：用 `period=month` 而非 `week`。需求只要一天，但 D2 + D2b 要求「久未使用也能拿到最后一个有数据的日子」，7 天窗口会在停更 8 天后返回空数组导致整段消失。

## Requirements

### R1 后端拉取与归一化
- R1.1 新增 `TokscaleClient` 作为唯一出站 HTTP 边界，请求 `GET /api/users/{username}?period=month`，超时 15s，仅对连接超时重试一次，跟随 308 重定向。
- R1.2 错误分类为 `not_found / ambiguous / rate_limited / timeout / upstream / schema`；日志只记 kind / status / elapsedMs / attempt，不记 body、不记 username。
- R1.3 `buildTokscaleLandingStats(raw: unknown)` 按 `date` 升序排序后取最后一个 `totals.tokens > 0` 的条目；过滤 `<synthetic>` 模型；`models` 为空但 `modelId` 非空时用 `modelId` 合成单条模型；软件与模型均按 cost 降序稳定排序；软件 id 经内置表解析为展示名，未知 id 原样透传。
- R1.4 `TokscaleService` 提供同步的 `getLandingStats()`（绝不触发或等待上游）与后台 `refreshFromStoredConfig()`；成功 TTL 10 分钟、失败抑制 1 分钟、single-flight、stale fallback、启动时刷新 + 定时器（`unref` + `onModuleDestroy` 清理）。
- R1.5 每次刷新重读 `getBaseConfigRaw().tokscaleUsername`；与快照对应的 username 不一致时清空快照并递增 generation。username 为空时不请求上游、快照置 `null`。

### R2 公开接口与共享类型
- R2.1 `GET /tokscale/stats` 公开、无鉴权，返回 `ITokscaleLandingStats | null`，`version: [VERSION_NEUTRAL, '1']`。
- R2.2 `@applog/common` 导出 `ITokscaleLandingStats` / `ITokscaleClientUsage` / `ITokscaleModelUsage` 与 `TOKSCALE_CLIENT_DISPLAY_NAMES`，形状见 [`design.md` §5](design.md)。
- R2.3 `ISystemBaseConfig` 增加 `tokscaleUsername?: string`。

### R3 Landing 展示
- R3.1 区块 kicker `AI Cost`、标题 `开发状态`、在 Landing 中的位置（Duolingo 之后、Slogan 之前）均不变。
- R3.2 卡片顶部：数据日期（今天 / 昨天 / `M月D日`）、总 token、总成本。
- R3.3 五段分布条 + legend，语义顺序 input → output → cacheRead → cacheWrite → reasoning，值为 0 的段与 legend 条目都不渲染。
- R3.4 软件分组列表：组头为「展示名 + 总 token · 总成本」，组内每行为「模型名（左） / token（右） / 成本（右）」，数值列 tabular-nums 对齐，模型名过长省略号截断。
- R3.5 token 格式为 `25.9M` / `848K` / `1.2B`；成本为 `$10.72`，大于 0 但小于 $0.01 显示 `<$0.01`，恰为 0 显示 `$0.00`。
- R3.6 `stats.stale === true` 或数据日期距今超过 3 天时显示「数据更新延迟」。
- R3.7 加载中显示 skeleton；`stats` 为 `null` 且非加载态时整段不渲染。
- R3.8 沿用现有卡片密度：无阴影、细外边框、软件组之间用留白不用分隔线；760px 以下 hero 竖排，不产生 390px 横向溢出。

### R4 管理配置
- R4.1 `LandingSettingsFields.vue` 新增「Tokscale 用户名」输入框，紧邻「天气城市」，说明文案表明留空即隐藏该区块。
- R4.2 确认 base config 保存路径带上新字段。

### R5 删除 WakaTime
- R5.1 删除后端 `module/wakatime/` 全目录及模块注册，清理 `system-config.service.ts` 中全部 WakaTime 成员与三处 `isWakaTimeConfigKey` 分支。
- R5.2 删除 common 的 `types/wakatime.ts`、`utils/wakatime-config.ts`、`IWakaTimeConfig`、`SYSTEM_WAKATIME_CONFIG_KEY`、`WAKATIME_API_KEY_MASK`、`SYSTEM_CONFIG_KEYS.WAKATIME_CONFIG` 及 `index.ts` 导出。删除时确认 `duolingo-config.ts` 的 `isValidIanaTimeZone` 未被连带删除。
- R5.3 删除前端 `api/wakatime/`、`useLandingWakaTimeStats.ts`、`wakatime-utils.ts`、`LandingWakaTimeStats.vue`、`wakatime/WakaTimeUsageCard.vue`、`WakaTimeSettings.vue` 及其挂载点。
- R5.4 删除 5 个 WakaTime 测试文件；用 `tokscale-guidelines.md` 替换 `wakatime-guidelines.md` 并更新 `spec/backend/backend/index.md`。
- R5.5 DB 中遗留的 `SYSTEM_WAKATIME_CONFIG` 行不迁移、不清理。

## Acceptance Criteria

- AC1 后端起来后 `curl localhost:4000/tokscale/stats` 返回当天（或最后一个有数据的日子）的快照；连续调用不产生额外的上游请求。
- AC2 该响应 JSON 中不含 `avatarUrl`、`rank`、`mcpServers`、`sessionCount`、`devices`、`user.id`。
- AC3 `totalTokens` 等于 `tokens` 五项之和；每个软件的 token/cost 等于其模型之和（用 fixture 断言）。
- AC4 fixture 中 `<synthetic>` 模型不出现在输出里；末尾零 token 日不被选中；`contributions` 非数组或全零时归一化抛 `TokscalePayloadSchemaError`，服务返回 `null`。
- AC5 `tokscaleUsername` 为空时后端不发起上游请求且 `/tokscale/stats` 返回 `null`；此时 Landing 不渲染该区块，其他区块正常。
- AC6 username 改动后，下一次刷新丢弃旧快照，不会把旧用户的数据挂在新用户名下。
- AC7 Landing 上该区块渲染出：日期、总 token、总成本、五段分布条（0 值段不出现）、按 cost 降序的软件分组、组内按 cost 降序的模型行，且模型行的 token 与成本两列右对齐。
- AC8 构造一个数据日期为 4 天前的快照时显示「数据更新延迟」；3 天前则不显示。
- AC9 390px 视口下卡片无横向溢出，hero 竖排。
- AC10 全仓 `rg -i wakatime` 只剩 `.trellis/tasks/archive/` 与 `docs/research/wakatime-landing-data.md`。
- AC11 下列命令全绿：common build、backend `test:unit` / lint / build、frontend `test:unit` / type-check / lint、`pnpm build`、`git diff --check`。

## Out of Scope

- 多日趋势、贡献热力图、周/月汇总视图——本次只做单日。
- `modelUsage` / `rank` / `activeDays` / `sessionCount` 等 tokscale 提供但本次不展示的字段。
- 每设备（`devices`）维度，以及 `/api/users/:username/devices` 系列接口。
- tokscale 订阅额度（Subscription Usage）与 MCP server 数据。
- DB 中遗留 WakaTime 配置行的迁移或清理脚本。
- `docs/research/wakatime-landing-data.md` 的删除——它是历史调研存档，保留。
- 软件 logo / 品牌色（tokscale 有 `SOURCE_LOGOS` / `SOURCE_COLORS`，本次只用文字展示名）。
