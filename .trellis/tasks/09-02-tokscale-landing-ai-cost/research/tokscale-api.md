# Tokscale API 调研（替换 WakaTime 作为 Landing AI Cost 数据源）

- Query: Landing 的 AI Cost 区块要从 WakaTime 换成 Tokscale，需要确认 `GET /api/me/stats` 与 `GET /api/users/:username` 分别能提供什么数据，能否支撑「过去一天 · 总/input/output/cacheRead/cost + 软件×模型二维列表」。
- Scope: external（tokscale 开源仓库源码 + 线上 live API 实测）+ 本机 CLI 配置
- Date: 2026-09-02
- 上游版本: tokscale CLI 4.15.0，submission schemaVersion 2，`/api/me/stats` schemaVersion 1

## 结论先行

1. **`GET /api/users/:username` 是唯一可用的数据源**，它是公开只读接口（无需任何凭证），并且是两个接口里唯一带「软件（client）× 模型（model）」二维明细的。
2. **`GET /api/me/stats` 不满足需求**，必须排除：它只有 `date / tokens / inputTokens / outputTokens / cost` 的日级汇总，**没有 cache read、没有软件维度、没有模型维度**，而且需要 Bearer personal token（引入了本可避免的密钥管理）。
3. 需求要的全部字段都能从 `contributions[]` 里最后一个有数据的日期直接读出，无需任何派生估算。
4. 上游数据新鲜度取决于本机 `tokscale submit`。本机已开启 autosubmit（`intervalMinutes: 120`），所以「今天」的数据是滚动更新、进行中的。
5. 日期桶不是 UTC 也不是服务端时区，而是**提交机器的本地时区**（本机 `scanner.bucketTimezone = "Asia/Shanghai"`），后端无法改变分桶口径。

## 一手来源

| 来源 | 用途 |
|---|---|
| [junhoyeo/tokscale](https://github.com/junhoyeo/tokscale) `packages/frontend/src/app/api/me/stats/route.ts` | `/api/me/stats` 的完整 wire contract |
| 同仓库 `packages/frontend/src/lib/publicProfileData.ts` | `/api/users/:username` 的完整响应构造逻辑 |
| 同仓库 `packages/frontend/src/lib/constants.ts` | `SOURCE_DISPLAY_NAMES` / `SOURCE_LOGOS` / `SOURCE_COLORS` 客户端展示名注册表 |
| 同仓库 `packages/frontend/src/lib/submissionFreshness.ts` | `submissionFreshness.isStale` 判定（默认 30 天窗口） |
| live `GET https://tokscale.ai/api/users/youranreus?period=week` | 实测响应，确认字段存在且数值自洽 |
| 本机 `~/.config/tokscale/settings.json` / `credentials.json` | username = `youranreus`；bucketTimezone / autosubmit 配置 |

## 接口一：`GET /api/me/stats` —— 不适用

```
Authorization: Bearer <personal api token>   // 必需；不接受 cookie session
```

响应（`schemaVersion: 1`）：

```ts
{
  schemaVersion: number
  totalTokens: number
  totalCost: number
  deviceCount: number
  lastSubmittedAt: string | null
  days: { date: string; tokens: number; inputTokens: number; outputTokens: number; cost: number }[]
  devices: { id: string; displayName: string; lastSubmittedAt: string | null }[]
}
```

排除理由（逐条对照需求）：

| 需求字段 | `/api/me/stats` |
|---|---|
| 总 token | ✅ `days[].tokens` |
| input | ✅ `days[].inputTokens` |
| output | ✅ `days[].outputTokens` |
| **cache read** | ❌ 不存在 |
| cost | ✅ `days[].cost` |
| **按软件维度** | ❌ 不存在（`devices` 是物理机器，不是 AI 软件） |
| **按模型维度** | ❌ 不存在 |

它的设计目标是给 CLI TUI 做「跨设备汇总」，源码注释明确写了 `Stable wire contract consumed by the CLI TUI`。

## 接口二：`GET /api/users/:username` —— 采用

```
GET https://tokscale.ai/api/users/{username}?period=all|week|month
```

- **无鉴权**，公开只读。
- Next.js `export const revalidate = 60`，上游自带 60s CDN/ISR 缓存。
- username 大小写不敏感；非规范大小写会 308 重定向到规范 URL（客户端需 follow redirect）。
- 用户不存在 → 404；username 歧义 → 409。

### period 参数语义

| period | 窗口 | contributions 长度 |
|---|---|---|
| `week` | 锚点日往前 7 个自然日 | ≤ 7 |
| `month` | 锚点日往前 30 个自然日 | ≤ 30 |
| `all`（默认） | 滚动 12 个月 | 可能数百条 |

**锚点日 = max(UTC today, 数据中最大日期)**。因为日期桶按提交机器本地时区计算，东八区用户可以合法地报出一个 UTC 还没到的日期。

→ 本任务只要「过去一天」，**用 `period=week`**：payload 最小（实测 11KB），同时保留一点上下文余量以防当天尚无数据。没有 `period=day`。

### 响应结构（只列与本任务相关的部分）

```ts
{
  user: { id, username, displayName, avatarUrl, createdAt, rank }
  stats: {                       // 已按 period 窗口聚合
    totalTokens, totalCost,
    inputTokens, outputTokens,
    cacheReadTokens, cacheWriteTokens, reasoningTokens,
    submissionCount, activeDays, sessionCount
  }
  dateRange: { start: string; end: string }
  chartRange: { start: string; end: string }
  period: "all" | "week" | "month"
  updatedAt: string | null                    // 最近一次 submit 的时间
  submissionFreshness: {
    lastUpdated: string
    cliVersion: string | null
    schemaVersion: number
    isStale: boolean                          // 默认超过 30 天未 submit 为 true
  } | null
  clients: string[]                           // 窗口内出现过的软件 id
  models: string[]
  modelUsage: { model, tokens, cost, percentage }[]   // 扁平模型维度，无软件归属
  contributions: Contribution[]               // ★ 本任务的数据源
}
```

### `contributions[]` —— 需求要的全部数据都在这里

```ts
interface Contribution {
  date: string                    // YYYY-MM-DD（提交机本地时区分桶）
  timestampMs: number | null
  totals: { tokens: number; cost: number; messages: number }   // messages 恒为 0，别用
  intensity: 0 | 1 | 2 | 3 | 4
  tokenBreakdown: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    reasoning: number
  }
  clients: {                      // ★ 软件维度
    client: string                // 软件 id，如 "pi" / "cursor" / "codex"
    modelId: string               // legacy 单模型字段，新数据为 ""
    models: Record<string, {      // ★ 模型维度（软件内）
      tokens: number
      cost: number
      input: number
      output: number
      cacheRead: number
      cacheWrite: number
      reasoning: number
      messages: number
    }>
    tokens: { input, output, cacheRead, cacheWrite, reasoning }
    cost: number
    messages: number
  }[]
}
```

### 实测数值自洽性（2026-09-02，用户 `youranreus`）

已验证以下恒等式在真实数据上成立，因此前端可以直接展示而不需要自己重算或对账：

- `totals.tokens == tokenBreakdown.(input + output + cacheRead + cacheWrite + reasoning)`
- 单个 model 的 `tokens == input + output + cacheRead + cacheWrite + reasoning`
- 某软件下所有 model 的 `input / output / cacheRead / cost` 之和 == 该软件的 `tokens.*` / `cost`

注意 `tokens` 是**含 cacheRead 的总量**，所以「总 token」这个数会被 cache read 主导（实测 cacheRead 占 92%）。这是 tokscale 自身的口径，与 WakaTime 的 token 口径不可比。

### 实测样本（`period=week`，2026-09-02）

```
dateRange  { start: 2026-08-27, end: 2026-09-02 }
updatedAt  2026-09-02T07:15:04.741Z
clients    [hermes, cursor, codex, pi]

 2026-08-27  tokens 105,499,256  cost $119.79   [hermes, cursor]
 2026-08-28  tokens  30,583,549  cost  $34.08   [cursor, hermes]
 2026-08-29  tokens     256,752  cost   $0.005  [hermes]
 2026-08-30  tokens     283,462  cost   $0.005  [hermes]
 2026-08-31  tokens  85,326,963  cost  $69.66   [hermes, codex, cursor]
 2026-09-01  tokens  86,780,847  cost  $74.80   [hermes, codex, cursor]
 2026-09-02  tokens  25,901,073  cost  $20.56   [pi, cursor, hermes]   ← 最后一天，进行中

最后一天明细：
  tokenBreakdown  input 1,848,988 · output 169,791 · cacheRead 23,855,370 · cacheWrite 0 · reasoning 26,924
  pi      $7.50
    gpt-5.5              8,356,750 tok  $6.8811
    gpt-5.6-terra        1,201,067 tok  $0.4719
    deepseek-v4-flash    4,647,198 tok  $0.1485
  cursor  $10.72
    cursor-grok-4.6-high-fast  8,074,430 tok  $10.7190
  hermes  $2.34
    gpt-5.6-sol            514,983 tok  $2.2979
    deepseek-v4-flash    3,106,645 tok  $0.0448
```

这个形状与需求描述的目标 UI 完全对应：

```
Pi (14.2M · $7.50)
  gpt-5.5                    8.4M    $6.88
  gpt-5.6-terra              1.2M    $0.47
  deepseek-v4-flash          4.6M    $0.15
```

## 软件 id → 展示名映射

`contributions[].clients[].client` 是原始 id（`pi`、`hermes`、`cursor`…），不是展示名。tokscale 自己的映射表在 `packages/frontend/src/lib/constants.ts` 的 `SOURCE_DISPLAY_NAMES`，**接口不返回它**，需要在 Applog 侧内置一份。相关条目：

```
opencode → OpenCode      claude  → Claude Code    codex   → Codex CLI
cursor   → Cursor        pi      → Pi             hermes  → Hermes Agent
gemini   → Gemini CLI    copilot → Copilot        kimi    → Kimi
droid    → Droid         zed     → Zed Agent      trae    → Trae
kiro     → Kiro          crush   → Crush          goose   → Goose
antigravity → Antigravity      antigravity-cli → Antigravity CLI
codebuddy → CodeBuddy    zcode   → ZCode          reasonix → Reasonix
omp      → Oh My Pi      fx      → Fx             grok    → Grok Build
...（完整表见上游 constants.ts，共 50+ 条）
```

后端在 `publicProfileData.ts` 里还做了一次 legacy 归一化：`kilocode → kilo`。未知 id 的兜底策略需要 Applog 侧自己定（建议原样透传 id）。

## 接入约束与风险

| 项 | 说明 |
|---|---|
| 鉴权 | 无。配置里只需要 username，**不需要保存任何密钥**，比 WakaTime 的 apiKey 少一整套脱敏/mask 逻辑 |
| 速率 | 上游 `revalidate = 60`，且 Applog 侧本来就是「后台定时刷新 + 进程内快照」模式，压力可忽略 |
| 时区 | 日期桶由提交机 CLI 决定（本机 Asia/Shanghai），服务端无法覆盖。因此 Applog 的配置里**不需要 timeZone 字段** |
| 新鲜度 | 取决于 `tokscale submit`。本机 autosubmit 每 120 分钟。`updatedAt` 可直接用于「数据更新于 X 前」 |
| 「今天」是进行中的 | 最后一天通常是当天且未结束，数字会持续变大 |
| 「今天」可能没有数据 | 若当天尚未 submit，`contributions` 最后一项就是昨天。取「最后一个有数据的日期」比取「今天」健壮 |
| 隐私 | 该接口本身就是公开 profile（`https://tokscale.ai/youranreus` 可直接访问），不含文件路径/项目名/session id 等敏感元数据，公开白名单压力远小于 WakaTime |
| `messages` 字段 | `contributions[].totals.messages` 恒为 0（源码注释 `Not tracked in breakdown`）；但 `clients[].models[].messages` 是真实值 |
| `<synthetic>` 模型 | 上游在 `modelUsage` 里过滤掉了 `<synthetic>`，但 **`contributions[].clients[].models` 里没有过滤**。Applog 侧需要自己过滤 |
| 契约稳定性 | 无官方 OpenAPI / 版本号（`/api/users/:username` 不带 schemaVersion）。需要容错解析 + fixture 契约测试 |

## Not Found / 未验证

- 上游没有 `period=day`，也没有单日专用接口。
- `/api/users/:username` 没有 schemaVersion 字段，无法程序化检测 breaking change。
- 未验证 404 / 409 的确切响应体（源码是 `{ error: string }`，未实测）。
- 未验证长时间无 submit 时 `submissionFreshness.isStale` 的实际表现（需 30 天窗口）。
