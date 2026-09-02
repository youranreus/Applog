# 技术设计：Landing AI Cost 切换到 Tokscale

配套文档：[`prd.md`](prd.md)、[`research/tokscale-api.md`](research/tokscale-api.md)

## 1. 架构与边界

保留 WakaTime / Duolingo / Garmin 三块共有的「后端定时刷新 → 进程内白名单快照 → 公开同步读」骨架，只替换上游 client 与归一化逻辑。

```
启动 / 10 分钟定时器
  → SystemConfigService.getBaseConfigRaw().tokscaleUsername
  → TokscaleClient.getUserProfile(username)        ← 唯一 HTTP 出口
  → buildTokscaleLandingStats(unknown)             ← 选日 + 归一化 + 白名单
  → 进程内 snapshot

浏览器
  → GET /tokscale/stats                            ← 同步读快照，绝不触发上游
  → useLandingTokscaleStats
  → LandingTokscaleStats.vue → TokscaleUsageCard.vue
```

不变的约束：浏览器永不直连 tokscale；公开 GET 同步返回快照或 `null`；`null` 时 Landing 整段不渲染，不影响其他区块。

## 2. 配置：从专用密钥 key 降级为 base config 字段

WakaTime 需要 apiKey，所以有一整套专用 key + 脱敏 + 专用 admin 端点。**Tokscale 只需要一个公开 username，没有任何密钥**，继续沿用那套是过度设计。

改为跟 `weatherCity` 一样的模式：

```ts
interface ISystemBaseConfig {
  // ...
  /** Tokscale 用户名，用于服务端拉取公开 AI 用量；空或未设置时 Landing 不展示 AI Cost */
  tokscaleUsername?: string;
}
```

由此顺带删除：`SYSTEM_WAKATIME_CONFIG_KEY`、`WAKATIME_API_KEY_MASK`、`SYSTEM_CONFIG_KEYS.WAKATIME_CONFIG`、`isWakaTimeConfigKey` 的三处分支、`getWakaTimeConfigRaw/Masked`、`setWakaTimeConfig`、`parseWakaTimeConfigValue`、`GET|PUT /wakatime/config`、`SetWakaTimeConfigDto`、`WakaTimeSettings.vue` 整个面板。

管理入口改为 `LandingSettingsFields.vue` 里新增一个输入框，与「天气城市」并列。启用判定同 weather：`trim()` 后非空即启用。

**兼容性**：DB 里遗留的 `SYSTEM_WAKATIME_CONFIG` 行不做迁移也不做清理——`isWakaTimeConfigKey` 删掉后它退化成一条普通系统配置，只有 admin 能读，且没有任何代码引用它。不写迁移脚本。

## 3. 上游契约

```
GET https://tokscale.ai/api/users/{username}?period=month
```

- 无鉴权、无 header 要求（只发 `Accept: application/json`）。
- **用 `period=month` 而不是 `week`**：需求只要一天，但 D2 要「最后一个有数据的日子」、D2b 要「久未使用也不隐藏」。`week` 只有 7 天窗口，停更 8 天就会返回空 contributions 从而整段消失，与 D2b 矛盾。`month` 给到 30 天缓冲，实测 payload 39KB / 3.6s，且这是后端后台请求，不进浏览器，代价可忽略。
- 需要 follow 308（username 大小写不规范时上游会重定向到规范 URL）。
- 超时 15s，与 WakaTime 一致；仅对 `ECONNABORTED` / `ETIMEDOUT` 重试一次。

错误分类（`TokscaleClientErrorKind`）：

| kind | 触发 |
|---|---|
| `not_found` | 404（用户名写错） |
| `ambiguous` | 409（用户名歧义） |
| `rate_limited` | 429 |
| `timeout` | 无 response 且 ECONNABORTED / ETIMEDOUT |
| `upstream` | 其他非 2xx |
| `schema` | 归一化阶段抛 `TokscalePayloadSchemaError` |

日志只记 `kind` / `status` / `elapsedMs` / `attempt`，不记 body、不记 username。

## 4. 选日与归一化

`buildTokscaleLandingStats(raw: unknown): ITokscaleLandingStats`

1. `raw.contributions` 不是数组 → 抛 `TokscalePayloadSchemaError`。
2. 按 `date` 升序排序（不依赖上游顺序）。
3. 取**最后一个 `totals.tokens > 0` 的条目**作为目标日。一个都没有 → 抛 `TokscalePayloadSchemaError`（service 捕获后快照为 `null`，Landing 隐藏）。
4. 日级：`totals.tokens` / `totals.cost` / `tokenBreakdown` 五项，缺字段按 `0` 处理（tokscale 这几个字段恒为数字，不存在 WakaTime 那种「缺失 ≠ 0」的语义）。
5. 软件级：遍历 `clients[]`，`client` 为 id，用 `TOKSCALE_CLIENT_DISPLAY_NAMES` 解析展示名，**未知 id 原样透传 id**。软件的 `tokens` 取五项之和，`cost` 直接用 `clients[].cost`。
6. 模型级：展开 `clients[].models`。过滤掉 `<synthetic>`。若某软件 `models` 为空但 `modelId` 非空（legacy 形态），用 `modelId` + 该软件的 totals 合成单条模型。两者都为空则该软件保留但无模型行。
7. 排序：软件按 `cost` 降序、同值按 `tokens` 降序、再按 `name` 升序保证稳定；组内模型同规则。
8. `updatedAt` 取 `raw.updatedAt`（可为 `null`）；`fetchedAt` 为归一化时刻。

不做的事：不重算 `totals.tokens`（上游已自洽，实测验证过），不做百分比派生（前端算），不返回 `user` / `rank` / `avatarUrl` / `mcpServers` / `sessionCount` 等无关字段。

## 5. 公开 DTO（`@applog/common`）

```ts
/** 某软件下单个模型的当日用量。 */
export interface ITokscaleModelUsage {
  /** 上游模型 id，如 gpt-5.6-terra */
  model: string;
  tokens: number;
  cost: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
}

/** 单个 AI 软件的当日用量及模型明细。 */
export interface ITokscaleClientUsage {
  /** 上游客户端 id，如 pi / cursor */
  id: string;
  /** 展示名；未知 id 时等于 id */
  name: string;
  tokens: number;
  cost: number;
  models: ITokscaleModelUsage[];
}

/** Landing 公开快照：过去一天的 AI token 用量。 */
export interface ITokscaleLandingStats {
  /** 数据所属自然日 YYYY-MM-DD（按提交机本地时区分桶） */
  date: string;
  /** 该日总 token，等于 tokens 五项之和 */
  totalTokens: number;
  /** 该日估算成本（USD） */
  totalCost: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    reasoning: number;
  };
  /** 按 cost 降序的软件列表；组内模型同样按 cost 降序 */
  clients: ITokscaleClientUsage[];
  /** 上游最近一次 submit 时间（ISO），可为 null */
  updatedAt: string | null;
  /** Applog 抓取快照的时间（ISO） */
  fetchedAt: string;
  /** 快照已过成功 TTL 且刷新失败 */
  stale: boolean;
}
```

隐私边界：tokscale 的 `/api/users/:username` 本身就是公开 profile（`https://tokscale.ai/youranreus` 任何人可访问），不含文件路径、项目名、分支、session id。因此该 DTO 不存在 WakaTime 那种「原始响应含敏感元数据」的问题，白名单的作用退化为「只取需要的字段」。仍然不转发 `user.id` / `avatarUrl` / `rank` / `devices` 等与本区块无关的内容。

展示名映射常量（`packages/common/src/constants/tokscale.ts`）：

```ts
export const TOKSCALE_CLIENT_DISPLAY_NAMES: Record<string, string> = {
  opencode: "OpenCode", claude: "Claude Code", codex: "Codex CLI",
  cursor: "Cursor", pi: "Pi", hermes: "Hermes Agent", /* ...完整表见 research */
};
```

放 common 而不是前端，因为解析发生在后端归一化阶段（DTO 里直接带 `name`），前端只渲染。

## 6. 缓存与刷新（`TokscaleService`）

沿用 WakaTime 的机制，只改常量：

| 机制 | 取值 / 行为 |
|---|---|
| 成功 TTL | **10 分钟**（WakaTime 是 30 分钟）。上游自带 60s revalidate、本机 autosubmit 每 120 分钟，10 分钟轮询足够，也让手动 `tokscale submit` 后较快反映到 Landing |
| 失败抑制 | 1 分钟 |
| single-flight | 同 generation 的并发刷新共享一个 promise |
| generation | base config 无专用保存回调，改为 **每次刷新都重读 username**；username 变化时清空快照并 `generation += 1` |
| stale fallback | 刷新失败且有旧快照 → 返回 `{...snapshot, stale: true}` |
| 冷启动失败 | 返回 `null`，Landing 隐藏整段 |
| 定时器 | `setInterval` + `unref()`，`onModuleDestroy` 清理 |

与 WakaTime 的一个实质差异：WakaTime 靠 `setConfig()` 主动 bump generation，Tokscale 的配置改动走通用 base-config 保存路径，不会通知本模块。因此 `refreshFromStoredConfig()` 里把「当前 username」与「快照对应的 username」比对，不一致就丢弃旧快照——把 generation 从「显式事件驱动」改为「每次刷新的幂等校验」。

## 7. 前端

### 文件

| 路径 | 职责 |
|---|---|
| `src/api/tokscale/index.ts` | `getTokscaleStats()` |
| `src/pages/Landing/hooks/useLandingTokscaleStats.ts` | `useRequest` 包装，失败折叠为 `null` |
| `src/pages/Landing/tokscale-utils.ts` | 纯格式化 / 派生函数 |
| `src/pages/Landing/components/LandingTokscaleStats.vue` | 区块壳（kicker / 标题 / skeleton / 延迟提示） |
| `src/pages/Landing/components/tokscale/TokscaleUsageCard.vue` | 数据面 |

### `tokscale-utils.ts`

```ts
/** 25901073 -> "25.9M"；1234 -> "1.2K"；0 -> "0" */
function formatTokenCount(value: number): string

/** 10.719 -> "$10.72"；0.0047 -> "<$0.01"；0 -> "$0.00" */
function formatUsd(value: number): string

/** "2026-09-02" 相对 today 渲染为「今天」/「昨天」/「9月2日」 */
function formatTokscaleDay(date: string, today: string): string

/** date 距 today 超过 3 天则为 true（阈值来自 D2b） */
function isTokscaleDataDelayed(date: string, today: string): boolean

/** 五项 token 的占比，用于分布条；总量为 0 时全部返回 0 */
function getTokscaleTokenShares(tokens: ITokscaleLandingStats['tokens']): number[]
```

`today` 由调用方注入（组件里取浏览器本地日期），保证纯函数可测。「距今 3 天」用浏览器本地日期比较：上游日期桶是提交机时区、读者是浏览器时区，两者最多差一天，而阈值是 3 天，偏差不影响结论。

### 卡片结构

```
9月2日 · 今天                                    ← 周期行
25.9M tokens                          $20.56     ← hero
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░            ← 五段分布条
● Input 1.8M 7%  ● Output 170K 1%  ● Cache Read 23.9M 92%  ● Reasoning 27K 0%
─────────────────────────────────────────────
Cursor                              8.1M · $10.72
  cursor-grok-4.6-high-fast          8.1M   $10.72
Pi                                  14.2M · $7.50
  gpt-5.5                            8.4M    $6.88
  gpt-5.6-terra                      1.2M    $0.47
  deepseek-v4-flash                  4.6M    $0.15
Hermes Agent                         3.6M · $2.34
  gpt-5.6-sol                        515K    $2.30
  deepseek-v4-flash                  3.1M    $0.04
```

- 分布条五段固定语义顺序 input → output → cacheRead → cacheWrite → reasoning；值为 0 的段与 legend 条目都不渲染（D3）。段色沿用现有卡片的中性灰阶并补足到五档：`#1d1d1f / #4a4f55 / #70757b / #989ea5 / #c3c8ce`。
- 模型行用 `grid-template-columns: minmax(0, 1fr) auto auto` 实现左右对齐，数值列 `font-variant-numeric: tabular-nums`，模型名过长 `text-overflow: ellipsis`。
- 软件全量、模型全量（D4），软件按 cost 降序、组内模型按 cost 降序，排序在后端完成，前端不再排。
- 「数据更新延迟」提示的触发条件：`stats.stale === true` 或 `isTokscaleDataDelayed(stats.date, today)`（D2b）。
- 沿用现有卡片的密度：无阴影、细外边框、无内部分隔线（软件组之间用留白而非 border），hero token 字号 `1.75rem–2.35rem`，760px 以下 hero 竖排。

区块 kicker 与标题维持 `AI Cost` / `开发状态`，Landing 中位置不变（Duolingo 之后、Slogan 之前）。

## 8. 删除清单

**后端**
- `src/module/wakatime/` 整个目录（8 个文件）
- `src/module/index.ts` / `src/app.module.ts` 中的 `WakaTimeModule` 注册
- `system-config.service.ts`：`getWakaTimeConfigKey` / `isWakaTimeConfigKey` 及其 3 处调用分支 / `parseWakaTimeConfigValue` / `getWakaTimeConfigRaw` / `getWakaTimeConfigMasked` / `setWakaTimeConfig` / 相关 import
- `test/wakatime.client.spec.ts`、`wakatime.service.spec.ts`、`wakatime.utils.spec.ts`、`wakatime-config.service.spec.ts`

**Common**
- `src/types/wakatime.ts`、`src/utils/wakatime-config.ts` 及 `src/index.ts` 的导出
- `src/types/system-config.ts` 的 `IWakaTimeConfig`
- `src/constants/system-config.ts` 的 `SYSTEM_WAKATIME_CONFIG_KEY` / `WAKATIME_API_KEY_MASK` / `SYSTEM_CONFIG_KEYS.WAKATIME_CONFIG`

**前端**
- `src/api/wakatime/`、`hooks/useLandingWakaTimeStats.ts`、`Landing/wakatime-utils.ts`
- `Landing/components/LandingWakaTimeStats.vue`、`Landing/components/wakatime/WakaTimeUsageCard.vue`
- `Dashboard/components/WakaTimeSettings.vue` 及 `SystemSettings.vue` 中的挂载
- `test/wakatime-utils.spec.mjs`

**Spec**
- `.trellis/spec/backend/backend/wakatime-guidelines.md`，替换为 `tokscale-guidelines.md`
- `.trellis/spec/backend/backend/index.md` 中对应的 checklist 行与索引行

`packages/common/src/utils/wakatime-config.ts` 复用了 `duolingo-config.ts` 的 `isValidIanaTimeZone`，删除时确认 Duolingo 侧仍在使用该函数，不要连带删掉。

## 9. 权衡与风险

| 项 | 决定 | 理由 / 代价 |
|---|---|---|
| 用 `period=month` 而非 `week` | month | 30 天缓冲让「久未使用不隐藏」成立；代价是 39KB 后端流量，可忽略 |
| 配置降级到 base config | 降级 | 少一个 key、一套脱敏、一个 admin 面板；代价是失去独立 `enabled` 开关（空 username 即关闭），与 weather 一致 |
| 上游无 schemaVersion | 容错解析 + fixture 契约测试 | `/api/users/:username` 不带版本号，breaking change 只能靠测试发现。归一化对每个字段做类型检查，异常时整段降级为 `null` 而不是渲染坏数据 |
| 展示名映射内置 | 内置在 common | 上游不通过接口暴露 `SOURCE_DISPLAY_NAMES`。新软件出现时会原样显示 id，属于可接受的降级，不是故障 |
| 「今天」是进行中的值 | 接受（D2） | 同日多次刷新数字会变大；卡片上标出日期即可 |
| 总 token 被 cacheRead 主导 | 如实展示 | 实测 cacheRead 占 92%，这是 tokscale 的口径。分布条会呈现为几乎单色，但这本身是信息 |
| 遗留 `SYSTEM_WAKATIME_CONFIG` 行 | 不迁移不清理 | 删掉专用分支后它就是一条无人引用的普通 admin 配置；写迁移脚本的风险大于收益 |
