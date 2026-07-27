# Duolingo landing 统计数据来源调研

## 结论

可以参考 DuoDash 的方式实现所需统计，但应把它视为“服务端定时抓取并缓存私有数据”，而不是浏览器直连 Duolingo：

1. 服务端用用户名查询 `userId`。
2. 服务端携带 Duolingo JWT 获取主用户数据和 XP 日汇总。
3. 将原始响应转换为 landing 页面需要的稳定 DTO，缓存后再提供给前端。
4. JWT 只存服务端 secret；前端、HTML、日志和公开接口响应中都不能出现 JWT。

DuoDash 使用的是 Duolingo 未公开文档化的版本化接口，不是稳定的官方开发者 API。字段名和认证策略可能随时变化，因此实现时需要超时、缓存、空态、字段 fallback 和监控。

本调研基于 DuoDash commit [`2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1`](https://github.com/Eyozy/duodash/tree/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1)，并于 2026-07-27 对 Duolingo 自有接口做了无凭证验证。

## 接口链路

| 步骤 | Endpoint | 作用 | 认证情况 |
| --- | --- | --- | --- |
| 1 | `GET https://www.duolingo.com/2017-06-30/users?username={username}` | 由用户名解析 `users[0].id`；响应也包含公开档案、`streak`、`courses`、`totalXp` 等 | 2026-07-27 无 JWT 实测 `200` |
| 2 | `GET https://www.duolingo.com/2023-05-23/users/{userId}` | 主用户数据：连胜、联赛 tier、全部课程等 | 2026-07-27 无 JWT 实测 `401` |
| 3 | `GET https://www.duolingo.com/2017-06-30/users/{userId}/xp_summaries?startDate={YYYY-MM-DD}` | 从指定日期开始的每日 XP、会话数、学习时长 | 2026-07-27 无 JWT 实测 `401` |

DuoDash 的服务端请求为步骤 1～3 都附带以下请求头：

```http
Accept: application/json
Authorization: Bearer <DUOLINGO_JWT>
User-Agent: Duolingo/7.41.4 (Android; 10; SM-G960F)
```

源码：

- [服务端请求链路、Bearer JWT、超时和错误处理](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/src/pages/api/data.ts#L34-L125)
- [DuoDash README 的接口与 JWT 获取说明](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/README.md#L150-L205)

公开 lookup 的一手响应验证中，`users[0]` 确实包含 `id`、`courses[].{id,title,learningLanguage,fromLanguage,xp}`、`streak`、`streakData`、`totalXp` 等字段。主数据与 XP 汇总无凭证均返回 `401` 和 `WWW-Authenticate: Basic realm="Realm"`。

## 展示项映射

### 1. 连胜天数

- 来源：主用户数据。
- 字段优先级：`site_streak ?? streak ?? 0`。
- 展示：整数天。
- DuoDash 证据：[转换逻辑](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/src/services/duolingoService.ts#L8-L18)。
- Duolingo 一手响应证据：公开 lookup 当前直接返回 `users[0].streak` 和 `users[0].streakData`。

建议保留 `site_streak`/`streak` 两个别名兼容，但不要通过 XP 历史自行重算连胜；冻结卡和时区规则会让重算结果偏离 Duolingo。

### 2. 排位等级

这里应把“排位等级”定义为**当前联赛段位**，不是联赛内第几名。DuoDash 只解析联赛 tier，没有获取本周 leaderboard 名次。

- 来源：主用户数据。
- 字段优先级：
  1. `tier`
  2. `trackingProperties.league_tier`
  3. `trackingProperties.leaderboard_league`
  4. snake_case 版本 `tracking_properties.*`
  5. 当前语言的 `language_data.*.tier`
- 映射：`0..9` 分别为青铜、白银、黄金、蓝宝石、红宝石、祖母绿、紫水晶、珍珠、黑曜石、钻石。
- DuoDash 证据：
  - [tier fallback](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/src/services/duolingoResolvers.ts#L99-L115)
  - [tier 到名称的转换](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/src/services/duolingoService.ts#L31-L33)
  - [联赛名称顺序](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/src/constants/tiers.ts#L9-L12)

注意：DuoDash 的 resolver 接受 `tier <= 10`，但名称数组只有 10 项；实现时应严格限制 `0 <= tier < 10`，未知值展示空态，并记录 schema drift。

### 3. 最近 7 天经验

- 来源：`xp_summaries.summaries[]`。
- 每日字段：
  - 日期：`date`，可能是 Unix 秒或日期字符串。
  - XP：`gainedXp ?? gained_xp ?? 0`。
- 推导：按目标时区生成“今天及之前 6 天”的 7 个日期键；同日期有多条 summary 时求和；缺失日补 0。
- 总计：7 个日值求和。
- DuoDash 证据：[XP 日聚合、滚动 7 日补零](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/src/services/historyBuilder.ts#L19-L65)。

DuoDash 为一次拿全历史使用 `startDate=1970-01-01`。landing 页面若只需要“7 天 + 当年热力图”，建议请求当年 `01-01`；跨年后的前 6 天要把 `startDate` 提前到“今天 - 6 天”与当年元旦两者中的较早日期。

### 4. 最近 7 天学习时间

- 来源：同一批 `xp_summaries.summaries[]`。
- 精确字段：`totalSessionTime ?? total_session_time`，单位为秒。
- 推导：按日累加秒数，再转换为分钟；最近 7 天的日期窗口与 XP 相同。
- DuoDash 证据：[时长字段和分钟换算](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/src/services/historyBuilder.ts#L32-L44)。

DuoDash 在时长为 0/缺失时使用 `ceil(gainedXp / 3)` 估算分钟，calendar fallback 也采用近似值。这不是 Duolingo 的真实学习时间。Applog 若将卡片标为“学习时间”，应只累加 `totalSessionTime`；字段缺失时展示“暂无数据”，不要把 XP 估算值伪装成精确时长。若产品确实需要估算，必须明确标注“估算”。

### 5. 语言分布（小卡片、前 2）

- 来源：主用户数据的 `courses[]`。
- 需要字段：`id`、`title`、`learningLanguage`、`fromLanguage`、`xp`，必要时可用 `subject` 区分非语言课程。
- DuoDash 行为：
  - 过滤 `xp > 0` 或当前学习课程。
  - 按 `xp` 降序。
  - 百分比为单课程 XP / 所有展示课程 XP。
- DuoDash 证据：
  - [课程解析及旧字段 fallback](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/src/services/duolingoResolvers.ts#L3-L71)
  - [按 XP 排序与占比计算](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/src/components/dashboard/CourseList.tsx#L12-L41)

Applog 的“语言分布前 2”建议采用：

1. 排除明确的数学、音乐等非语言 course（DuoDash 的主接口特意包含这些课程）。
2. 若同一目标语言因 `fromLanguage` 不同出现多门课程，按 `learningLanguage` 合并 XP；产品若要体现课程而非语言，则不要合并，并把标题改为“课程分布”。
3. 对全部语言 XP 计算分母，再 `sort(xp desc).slice(0, 2)`；不要只用前 2 的 XP 作为分母，否则占比会被放大。

这里的 XP 是累计课程 XP，因此表示历史语言分布，不是最近 7 天的语言分布。

### 6. 年度学习热力图

- 来源：`xp_summaries.summaries[]`，字段仍为 `date`、`gainedXp/gained_xp`；可附加当天 `totalSessionTime`。
- 推导：
  1. 按 `YYYY-MM-DD` 聚合每天 XP。
  2. 生成目标年份 1 月 1 日至 12 月 31 日的完整日历。
  3. 没有 summary 的日期填 0；未来日期建议显示为空而不是 0。
  4. 颜色强度由当年每日 XP 分档或分位数决定。
- DuoDash 证据：
  - [构造年度日期数据](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/src/services/historyBuilder.ts#L92-L102)
  - [热力图按选择年份补全日历并计算强度](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/src/components/charts/HeatmapChart.tsx#L85-L150)

DuoDash 的 `yearlyXpHistory` 实际包含接口返回的所有年份，年份过滤发生在组件中；如果 landing 只展示本年度，服务端 DTO 可直接只返回当年数据。

## 推荐的 landing DTO

前端不应感知 Duolingo 的多套字段别名。服务端可输出：

```ts
interface DuolingoLandingStats {
  streakDays: number | null;
  league: {
    tier: number;
    name: string;
  } | null;
  last7Days: Array<{
    date: string; // YYYY-MM-DD
    xp: number;
    learningSeconds: number | null;
  }>;
  languages: Array<{
    code: string;
    name: string;
    xp: number;
    share: number; // 0..1，分母为全部语言 XP
  }>; // 最多 2 项
  yearlyXp: Array<{
    date: string;
    xp: number;
  }>;
  fetchedAt: string;
  stale: boolean;
}
```

`null` 表示上游未提供或无法可靠解析；不要用 `0` 混淆“真实为零”和“无数据”。

## 认证、CORS、隐私与稳定性限制

### 认证和 secret

- DuoDash 要求配置 `DUOLINGO_JWT`，以 `Authorization: Bearer ...` 从服务端访问主数据和 XP 汇总。
- JWT 会过期；DuoDash 对 `401/403` 映射为 `JWT_EXPIRED`，需要重新获取。
- JWT 是账号凭证，不应发送给浏览器，也不应提交 Git、写入日志或错误响应。
- landing 页面是公开表面；只公开明确选择的聚合字段，不要透传整个 Duolingo 用户对象。

### CORS

2026-07-27 实测：

- 对公开 lookup 发送 `Origin: https://example.com`，响应没有 `Access-Control-Allow-Origin`。
- 对主数据 endpoint 发起带 `authorization` 的 OPTIONS 预检，虽返回 `204`，仍没有 `Access-Control-Allow-Origin` 或 `Access-Control-Allow-Headers`。

因此浏览器不能可靠地直连并读取响应；而且浏览器直连会暴露 JWT。必须经 Applog 服务端或受控的定时任务代理。

### 缓存和限流

- DuoDash 源码当前的服务端内存缓存 TTL 是 30 分钟，并限制最多 100 个 key；响应给浏览器的缓存标记为 `private, max-age=60`。
- [缓存常量](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/src/constants/config.ts#L1) 与 README 所写“5 分钟”不一致，应以代码为准。
- 内存 Map 在 serverless 冷启动后会丢失，不能作为稳定持久缓存。
- Duolingo 没有为这些未文档化接口公布可依赖的限流契约。建议后台每 30～60 分钟刷新，失败时继续提供上次成功快照并标记 `stale`，不要让每位访客触发一次上游请求。
- DuoDash 请求超时为 8～12 秒；`startDate=1970-01-01` 会取全历史，数据会持续增长。只取当前展示所需范围更稳妥。

### 日期和时区

- XP summary 的日期可能是 Unix 秒或日期字符串，必须统一成 `YYYY-MM-DD`。
- 对“日期字符串”应把它当作日历日期键，不要先强制解释成 UTC 午夜再转用户时区，否则 UTC 负偏移地区可能落到前一天。
- DuoDash 的 `parseSummaryDateKey` 会把字符串拼成 `T00:00:00Z` 后再转时区；且 `historyBuilder` 调用时没有把已经解析的用户时区继续传入。这一实现存在日期偏移风险，不建议原样复制。
- DuoDash 证据：[日期解析实现](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/src/utils/dateUtils.ts#L83-L97) 与 [historyBuilder 调用点](https://github.com/Eyozy/duodash/blob/2c8ae791bccdd3ee13d754e671f1e4bbfd16f5b1/src/services/historyBuilder.ts#L32-L36)。

### API 与产品风险

- 三个 endpoint 都是 Duolingo 自有、带日期版本的未公开接口；DuoDash 自己也将其称为“非官方接口”。不能假设 schema、认证、可用性长期稳定。
- 主接口可能同时返回语言、数学、音乐课程；“语言分布”必须明确过滤或改名。
- 联赛 tier 不等于联赛内排名。若 UI 写“排名”或“第 N 名”，当前数据链路不能支持。
- 应在项目中保留“与 Duolingo Inc. 无关”的第三方说明，并在上线前确认使用方式符合 [Duolingo 服务条款](https://www.duolingo.com/terms) 和公开展示个人学习数据的隐私预期。

## 实现验收要点

- 所有 Duolingo 请求只发生在服务端，JWT 不进入前端 bundle/响应/日志。
- 上游 401/403、超时、字段缺失时，landing 仍能渲染上次成功快照或明确空态。
- 连胜优先 `site_streak`，fallback 到 `streak`。
- 联赛只接受 `0..9`，并标为“联赛/段位”，不标为“名次”。
- 7 日窗口含今天，固定返回 7 个日期；缺失 XP 填 0，缺失学习时长填 `null`。
- 学习时间只使用 `totalSessionTime`，除非 UI 明确写“估算”。
- 语言只保留语言课程、按目标语言聚合，全部语言 XP 为占比分母，最终取前 2。
- 热力图按目标年份补全日历；未来日期与真实 0 XP 日期使用不同状态。
- 日期字符串作为日历日期键处理，Unix 秒才按指定展示时区转换。
- 缓存至少 30 分钟，上游失败可 stale-while-error，不让公开流量直接放大为上游流量。
