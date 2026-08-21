# WakaTime Landing 数据能力与 AI 指标调研

- Query: WakaTime 截至 2026-08-21 有哪些官方 API / 公开分享能力可支撑 Applog 个人 Landing，尤其是 AI 编程方向；哪些指标可原生读取、可安全派生或当前不可取，以及适合怎样展示。
- Scope: mixed（WakaTime 官方 API、官方定价/FAQ/Features、官方 GitHub 仓库；结合 Applog 现有 Landing 代码与 Trellis 规范）
- Date: 2026-08-21
- API version: WakaTime API v1（`https://api.wakatime.com/api/v1/`）

## 结论先行

1. WakaTime 现在已经不是只有「编码时长」：官方 v1 API 的 `Stats`、`Summaries`、`Durations` 和 `Heartbeats` 明确包含 AI / 人工行变更、按模型的行变更与估算成本、输入/输出 token、prompt 字符长度、prompt 次数和 AI session 数；`Insights/ai_days` 还直接提供每日 AI-vs-human 行变更百分比。[官方 API：Stats](https://wakatime.com/developers#stats) [官方 API：Summaries](https://wakatime.com/developers#summaries) [官方 API：Insights](https://wakatime.com/developers#insights)
2. live 文档使用 `ai_model_*`，并未定义独立的 `ai_agent_*` 聚合维度。工具/agent 只能由 `editors` 聚合或 `User Agents.editor` / plugin 记录识别；模型则可由 `ai_model_line_changes`、`ai_model_costs`、`ai_model_breakdown`，以及 `User Agents.ai_model(_version/_complexity)` 原生读取。[官方 API：User Agents](https://wakatime.com/developers#user-agents)
3. `ai_additions + ai_deletions` 是「AI 造成的行变更事件」，不是「当前代码库中由 AI 写成的代码占比」，也不是接受率。Landing 应写成「AI 行变更占比」；当前 live API 没有 `acceptance_rate`，且现有增删行计数无法安全重建接受/保留率。[官方 API：Stats 字段](https://wakatime.com/developers#stats)
4. 对个人 Landing，推荐服务端使用最小 OAuth scope / API Key 拉取并生成白名单快照；WakaTime 明确禁止把 secret API key 放进公开网页，只有可撤销的 embeddable JSON/SVG 适合浏览器直连。[官方 API：Security 与 Embedding](https://wakatime.com/developers#embedding-charts-json)
5. MVP 最适合「7/30 天编码时长指标卡 + 日历热力图 + AI/人工行变更热力环 + Top 语言/编辑器条带」。目标 Free 账号实测可从 Stats/Summaries 读取模型、prompt、token、session 和估算成本字段，但 `Insights/ai_days` 返回 402；因此是否能展示 AI 聚合数据不能只按 Pricing 页面推断，必须按 endpoint 做能力探测。[官方 Pricing](https://wakatime.com/pricing) [官方 API：Stats](https://wakatime.com/developers#stats)

## 外部一手资料

| 官方来源 | 本报告使用范围 |
|---|---|
| [WakaTime API v1](https://wakatime.com/developers) | endpoint、scope、请求约束、返回字段、缓存/分页/速率限制 |
| [WakaTime Pricing](https://wakatime.com/pricing) | Free / Basic / Premium / Team 的公开产品能力边界 |
| [WakaTime FAQ](https://wakatime.com/faq) | AI 成本估算口径、历史保留、导出、时长准确性、隐私配置 |
| [WakaTime Features](https://wakatime.com/features) | 实际收集的元数据种类与“不上传源码”的官方说明 |
| [WakaTime Share](https://wakatime.com/share) | badges、embeddable charts、goals、public JSON 等分享能力 |
| [wakatime-cli 官方 USAGE](https://github.com/wakatime/wakatime-cli/blob/develop/USAGE.md) | AI transcript 检测开关与项目识别/隐私配置 |
| [WakaTime 官方 GitHub 组织](https://github.com/wakatime) | 官方 CLI 与 Claude Code、Cursor、VS Code 等插件生态 |

### 资料版本注意

- 本报告以 2026-08-21 可访问的 live `wakatime.com/developers` 为准。搜索缓存中偶尔能看到 `ai_agent_*` 旧/旁支字段，但 live 文档当前公开的是 `ai_model_*`；生产契约不应依赖缓存字段。
- 未找到 WakaTime 官方发布、可独立版本锁定的 OpenAPI 文件；官方 Developer API HTML 是当前权威 schema。因此建议接入时对响应做容错解析并保留契约测试。

## 目标账号 live API 验证

- 验证日期：2026-08-21；账号套餐：Free。
- 鉴权来源：本机 `~/.wakatime.cfg` 的 `api_key`，仅通过 HTTP Basic Auth 发往 WakaTime 官方 API；未打印、复制或写入凭证。
- 记录范围：只保留 HTTP 状态、字段路径和脱敏后的能力判断；未保存邮箱、项目名、文件路径、分支、机器、原始 user agent、session ID 或完整响应。

| 资源 | 实测结果 | 能力结论 |
|---|---|---|
| Current User | 200 | 鉴权有效，套餐为 Free。 |
| All Time Since Today | 200 | 累计时长、日均、范围和 freshness 字段可直接使用。 |
| Stats / last 7 days | 200，`is_up_to_date=true`、`percent_calculated=100` | 基础时长、语言、编辑器以及 AI/human additions/deletions、模型、成本、token、prompt、session 字段均实际存在且当前账号有数据。 |
| Stats / last 30 days | 首次 202，稍后重试 200，最终 `is_up_to_date=true` | Free 账号可读取完整 30 天 Stats，但服务端必须把 202 / 未完成响应映射成 `pending`，退避重试并保留 last-known-good。 |
| Summaries / 30 days | 200，返回完整 30 个日项 | 可支撑 30 天编码热力图、活跃天与日级 AI/human 统计；`cumulative_total`、`daily_average` 均存在，`timezone=Asia/Shanghai` 的 UTC 边界正确换算。 |
| Insights / ai_days / last 30 days | 402，`Upgrade to unlock this and more features.` | Free 账号不能使用官方 AI-vs-human 日百分比 Insights。MVP 应由 Summaries 的日级 additions/deletions 自行计算，或隐藏该视觉。 |
| Status Bar / today | 200 | 今日缓存 Summary 可读，可做非强实时状态卡。 |
| User Agents | 200，分页元数据存在 | `editor`、`ai_model`、`ai_model_version`、`ai_model_complexity` 均有实际记录；只应公开规范化 tool/model 名。 |
| Durations / 单日 | 200 | AI/human 行变更、模型、token、prompt、session 字段可读，可派生小时桶；因包含精确时段和项目，仍不建议 MVP 使用。 |
| Heartbeats / 单日 | 200 | 原始 AI/human 行变更、token、prompt 长度和 session 字段可读；同时暴露文件、项目、分支、机器和精确时间，Landing 禁止直用。 |
| Goals | 200，空数组 | endpoint 可用，但当前账号没有目标；UI 应视为“未配置”而非错误。 |
| Projects | 200，分页元数据存在 | endpoint 可用，但名称、repository 和 clients 属于敏感信息；除显式 allowlist/alias 外不得进入公开响应。 |

### 实测发现的契约风险

- 同一份 7 天 Stats 中，`ai_line_changes_total` 与 `ai_additions + ai_deletions` 实际不相等。它们不能作为可互换字段；Landing 的「AI 行变更占比」应固定使用文档化的 additions/deletions 公式，并用真实 fixture 锁定口径。
- AI 字段在目标 Free 账号上实际可用，不能把“Free 套餐”直接映射成 `aiAvailable=false`；应按 endpoint 状态和字段 presence 判断。
- 30 天 Stats 的首次 202 是正常后台计算流程，不是失败。公开 snapshot 需要 `pending/stale/last-known-good` 三态。
- User Agents 和 Projects 的 live 响应都带 `page/next_page/prev_page/total/total_pages`；即使文档示例未强调分页，接入也不能只消费第一页后声称覆盖完整历史。

## 主要 API / 公开能力矩阵

下表只列与个人 Landing 或能力判断相关的读取端点。所有 `/users/:user/...` 通常也有 `/users/current/...` 版本；实现个人账号集成时优先 `current`，避免多余身份参数。

| 资源 | endpoint / scope | 返回数据域与关键字段 | 时间/分页/缓存 | Landing 价值与判断 |
|---|---|---|---|---|
| All Time Since Today | `GET /users/current/all_time_since_today`；`read_stats` | `total_seconds`, `daily_average`, `text/digital/decimal`, `range.start/end/timezone`, `is_up_to_date`, `percent_calculated`, `timeout` | 自建号日起至今日；文档明确 Free 可用；未就绪可 202 | 适合「累计创作时长」指标卡；这是跨套餐最稳的长期指标。[官方文档](https://wakatime.com/developers#all-time-since-today) |
| Stats | `GET /users/current/stats/:range`；`read_stats` 或细粒度 `read_stats.*` | 总时长/日均、`best_day`、categories/projects/languages/editors/OS/dependencies/machines；AI 总量、模型、成本、token、prompt、session；可见性与缓存状态 | `YYYY`、`YYYY-MM`、`last_7_days`、`last_30_days`、`last_6_months`、`last_year`、`all_time`；`is_up_to_date`/`percent_calculated` | 单次请求覆盖 Landing 大多数卡片。优先用 7/30 天范围，公开 DTO 不转发 project/machine 原值。[官方文档](https://wakatime.com/developers#stats) |
| Summaries | `GET /users/current/summaries`；`read_summaries` 或 `read_summaries.*` | 按日 `grand_total`；categories/projects/languages/editors/OS/dependencies/machines；project/editor/entity 下有 AI 模型、成本、token、prompt、session；`cumulative_total`, `daily_average` | `start/end/timezone` 或 Today/Yesterday/7/14/30 天、本/上周、本/上月；按日数组，无文档化 pagination | 最适合热力图、30 天趋势和日级 AI 指标；长范围上限未在当前文档写明，必须实测。[官方文档](https://wakatime.com/developers#summaries) |
| Insights | `GET /users/current/insights/:insight_type/:range`；`read_summaries` | `stats`, `weekdays`, `days`, **`ai_days`**, `best_day`, `daily_average`, projects/languages/editors/categories/machines/OS；`ai_days` 为每日 AI-vs-human 行变更百分比；`stats` 与 Stats 同含模型/成本 | 范围与 Stats 类似；`days` 可按 weekday；有 `is_up_to_date`, `percent_calculated` | `ai_days` 是双变量 AI 热力图最直接的数据源；weekdays/days 可做工作节奏图。[官方文档](https://wakatime.com/developers#insights) |
| Status Bar | `GET /users/current/status_bar/today`；`read_summaries` | 今日 Summary 的缓存版：total/categories/projects/languages/editors/OS/dependencies/machines；空缓存会先返回空 Summary；带 `cached_at` | 仅今日，只读缓存 | 可做「今天写了多久」小卡，但不是强实时，必须显示 `cached_at` 或允许暂时为 0。[官方文档](https://wakatime.com/developers#status-bar) |
| Durations | `GET /users/current/durations?date=...`；`read_heartbeats` | 时段 `time`, `duration`；AI/human additions/deletions、`ai_model_costs`、token、prompt 统计、session；`slice_by` 支持 project/entity/language/dependencies/os/editor/category/machine | 单日；时区可指定；按 heartbeat 间隔（默认 15m keystroke timeout）合并 | 可派生 24 小时「热力环」、focus session 和按维度 AI 节奏；scope 较大、请求量高，只应服务端聚合。[官方文档](https://wakatime.com/developers#durations) |
| Heartbeats | `GET /users/current/heartbeats?date=...`；`read_heartbeats` | 原始事件：`entity`, type/category/time/project/branch/language/dependencies/machine；`ai_line_changes`, `human_line_changes`, `ai_session`, token, prompt length, subscription plan；文件行数/光标/写入状态 | 单日事件；无文档化 pagination | 数据最细但隐私风险最大。Landing 不应直接使用；仅在无法由聚合 API 得到指标时服务端离线聚合并立即丢弃原始值。[官方文档](https://wakatime.com/developers#heartbeats) |
| Projects | `GET /users/current/projects`；`read_stats.projects` | id/name/repository/badge/color/clients；`has_public_url`、first/last heartbeat、project URL | `q` 搜索；文档未写分页 | 可维护项目 allowlist/别名和跳转。project、repository、client 名称可能泄密，默认不公开。[官方文档](https://wakatime.com/developers#projects) |
| User Agents | `GET /users/current/user_agents`；`read_stats.editors` | plugin `value`, `editor`, `version`, `os`, first/last seen；`ai_model`, `ai_model_version`, `ai_model_complexity` | 文档未写分页 | 可确认正在使用的插件/AI 模型版本；`value` 原始 UA、版本、OS 不宜直接公开，只输出规范化 editor/model 名。[官方文档](https://wakatime.com/developers#user-agents) |
| Editors / Languages catalogs | `GET /editors`、`GET /program_languages`；无用户 scope | 官方 editor/plugin 名、颜色、官网/仓库/版本；语言名、颜色、verified | 公共字典；languages 响应有 total_pages，但请求分页参数未完整说明 | 可安全给 Top editor/language 配官方色与链接；不是个人使用统计。[官方 Editors](https://wakatime.com/developers#editors) [官方 Languages](https://wakatime.com/developers#program-languages) |
| Goals | `GET /users/current/goals`；`read_goals` | goal 秒数、day/week delta、filters、`chart_data.actual_seconds/goal_seconds/range_status`、status；还包含 owner/shared/subscriber PII | `total_pages`，当前 GET 文档未写 `page` 参数；Free 1 个、Basic 3 个、Premium unlimited | 适合可选「本周目标」进度环；必须剥离 owner、email、shared/subscribers 等信息。[官方 API](https://wakatime.com/developers#goals) [套餐](https://wakatime.com/pricing) |
| Leaders（公开） | `GET /leaders`；文档未列用户 scope | `rank`, running total/日均/languages；AI 模型成本；用户公开资料；`board_type=time/manual/ai/spend` | `page`；至少每 12h 更新 | 可做低优先级「全球 AI 行排名」，但容易造成竞赛/生产力误导；只在本人明确公开且能定位 rank 时展示。[官方文档](https://wakatime.com/developers#leaders) |
| Private leaderboards | `GET /users/current/leaderboards(/:board)`；`read_private_leaderboards` | 成员、rank、AI model costs、board 元数据；固定 last 7 days | 分页；Premium 50 seats，Basic 5，Free 不列 | 不适合个人公开 Landing，且包含第三方成员数据；仅记录能力，不建议接入。[官方文档](https://wakatime.com/developers#private-leaderboards) |
| Org dashboards | `/users/current/orgs/:org/dashboards/...`；`read_orgs` | dashboards/members、member durations/summaries、隐私与权限字段 | 多数列表有 page/next/prev/total_pages；Team/Business 能力 | 团队分析能力完整，但不是个人 Landing 数据源，也不应把同事数据公开。[官方 API](https://wakatime.com/developers#org-dashboards) [Team 套餐](https://wakatime.com/pricing/teams) |
| Data Dumps | `GET/POST /users/current/data_dumps`；`read_heartbeats` | 生成 `heartbeats` 或 `daily` 全量 JSON，status/progress/download URL/expiry | 异步导出；账户创建以来；下载 URL 有时效 | 适合离线回填，不适合每次 Landing 请求；下载 URL 与原始导出必须视为 secret。[官方 API](https://wakatime.com/developers#data-dumps) [官方 FAQ](https://wakatime.com/faq) |
| Commits | `GET /users/current/projects/:project/commits(/:hash)`；`read_heartbeats` | commit hash/message/author、编码耗时、repo 元数据 | list 支持 `page`, author/branch | 可派生「本周 ship 次数/每 commit 投入」，但 Premium 才列高级 commit/PR stats，且 commit message/repo 易泄密；不进 MVP。[官方 API](https://wakatime.com/developers#commits) [套餐](https://wakatime.com/pricing) |
| Public Share / Embeddables | WakaTime 后台生成的 unique URL；SVG/JSON/JSONP | badges、project charts、real-time embeddable charts、goals、insights、public JSON | URL 可撤销；官方 API 不支持 CORS；embeddable JSON 支持 JSONP | 无后端时唯一安全的浏览器直连方式。但字段选择/契约可控性不如 Applog 自建后端快照；优先后端集成，embeddable 作为快速原型或降级。[官方 Developer API](https://wakatime.com/developers#embedding-charts-json) [官方 Share](https://wakatime.com/share) |
| Aggregate Stats（全站） | `GET /stats/:range`；文档未列 scope | 全体用户的 category/editor/OS/total 分布；年度 AI/manual time、AI/human line changes、平均 model costs | `last_7_days` 或 2013 起某年；年度值每年 1 月 1 日冻结 | 可做匿名「与全站中位数相比」基准，但口径固定 15m/非 writes-only，且不是个人指标；进阶可选。[官方文档](https://wakatime.com/developers#stats-aggregated) |

## AI 数据专项矩阵

### 判定规则

- **原生可取**：当前官方 endpoint response 明列该字段/维度。
- **可合理派生**：可由已文档化字段做确定性聚合；必须在文案中保留真实口径。
- **当前不可取**：live API schema 未公开该指标，或已有字段不足以可靠推回。

| AI 主题 | 判定 | 数据源 / 公式 | 重要边界 |
|---|---|---|---|
| AI Coding 活动时长 | 原生可取 | `categories[name≈AI Coding].total_seconds/percent`；Heartbeat `category=ai coding`；全站 Aggregate Stats 也有 `ai_coding` | 是「AI coding 类别活动时间」，不等价于 AI 产出或节省时间。[Categories/Heartbeats](https://wakatime.com/developers#heartbeats) |
| AI / human 行增删 | 原生可取 | Stats/Summaries/Durations 的 `ai_additions`, `ai_deletions`, `human_additions`, `human_deletions`；Heartbeat 是合计 `*_line_changes` | 行变更是编辑事件，删除也计入；不可称为「代码所有权」或「当前仓库 AI 百分比」。[Stats](https://wakatime.com/developers#stats) |
| 每日 AI-vs-human 比例 | 原生可取 | `Insights/ai_days` 明确返回每日 AI-vs-human line change percentages | 最适合双变量日历；仍是行变更口径。[Insights](https://wakatime.com/developers#insights) |
| AI 行变更占比 | 可合理派生 | `(ai_additions + ai_deletions) / (ai_additions + ai_deletions + human_additions + human_deletions)`；分母 0 时为 null | UI 必须命名「AI 行变更占比」；不可命名「AI 代码占比」。 |
| AI 模型族 | 原生可取 | `ai_model_line_changes`, `ai_model_costs`, `ai_model_breakdown[].name` | 官方字段以 model 为中心；模型名来自 WakaTime 检测。[Stats](https://wakatime.com/developers#stats) |
| 模型版本 / reasoning effort | 原生可取（非聚合） | `User Agents.ai_model_version`, `ai_model_complexity` | 只说明某 plugin/user-agent 被检测到，不直接给每版本的时长/行数；不要据此伪造版本占比。[User Agents](https://wakatime.com/developers#user-agents) |
| AI 工具 / agent（Claude Code、Codex、Cursor 等） | 部分原生，可保守派生 | `editors[].name`、`User Agents.editor` 和官方 plugin 清单；Stats 的 editor 项下有模型/成本/token/prompt/session | live schema 无独立 `ai_agent` 维度；IDE 内同时运行多个 agent 时，editor 不能可靠等同 agent。标题应为「AI 工作环境」或「检测到的工具」，不要写「Agent 市占」。[User Agents](https://wakatime.com/developers#user-agents) [官方工具清单](https://wakatime.com/) |
| AI input/output token | 原生可取 | Stats/Summaries/Durations/Heartbeats 的 `ai_input_tokens`, `ai_output_tokens` | token 覆盖度取决于具体 AI 工具/插件是否上报；适合趋势比较，不应直接当成订阅账单用。[API](https://wakatime.com/developers#stats) [Features](https://wakatime.com/features) |
| Prompt 字符长度 | 原生可取 | `ai_prompt_length_avg/sum`, per-session avg/median；`ai_prompt_events_total/avg/median_per_session` | API 只有长度/次数，没有 prompt 文本，这是有利的隐私边界。[API](https://wakatime.com/developers#stats) [Features](https://wakatime.com/features) |
| AI session 数 | 原生可取 | 聚合 `ai_sessions`；Heartbeat `ai_session` ID | Landing 只公开计数，永不公开 session ID。[Heartbeats](https://wakatime.com/developers#heartbeats) |
| 模型估算成本 | 原生可取 | `ai_model_costs`, `ai_model_total_cost`, breakdown `cost` | 官方按典型 API token 单价估算，不读取订阅账单；只用于模型/趋势比较。[FAQ](https://wakatime.com/faq) |
| Tokens / AI 行变更 | 可合理派生 | `(ai_input_tokens + ai_output_tokens) / ai_line_changes_total` | 仅称「每次 AI 行变更对应 token」或「token/AI changed line」；不是质量分。官方也把 tokens per line 用作模型效率比较。[AI overview](https://wakatime.com/) |
| 成本 / AI 行变更 | 可合理派生 | `ai_model_total_cost / ai_line_changes_total`，分母 0 时 null | 是估算效率，不是 ROI；小样本隐藏或显示样本量。 |
| Prompt 密度 | 原生或派生 | 优先官方 `ai_prompt_events_avg_per_session`；否则 prompts/session | 只表达互动节奏，不推断「提示词质量」。 |
| AI-by-project | 原生可取 | Stats/Summaries `projects[]` 内完整 AI 模型、成本、token、prompt、session 字段 | project 名可能泄漏客户/产品；必须 allowlist/alias 或只汇总成「公开项目/其他」。[Summaries](https://wakatime.com/developers#summaries) |
| AI-by-editor | 原生可取 | Stats/Summaries `editors[]` 内 model/cost/token/prompt/session | 可用来表现不同 IDE/CLI 的 AI 使用，但仍不等于独立 agent。[Stats](https://wakatime.com/developers#stats) |
| AI-by-language / dependency / OS / machine | 可派生但不推荐 MVP | Durations 支持 `slice_by=language/dependencies/os/machine`，duration 又带 AI 字段；按日服务端聚合 | 需 `read_heartbeats`、多日请求与更细粒度数据；机器名/IP 永不公开。聚合结果样本小也会泄露工作模式。[Durations](https://wakatime.com/developers#durations) |
| Prompt 文本/主题/意图 | 当前不可取 | live API 只暴露 prompt 长度/次数；官方收集清单也只写 character lengths | 不要声称能做「常用提示词主题」或 prompt word cloud。[Features](https://wakatime.com/features) |
| AI 接受率 / suggestion acceptance rate | 当前不可取 | live schema 无 `acceptance_rate`；AI/human additions/deletions 不记录 suggestion offered/accepted/rejected 的完整事件链 | 不能用 AI 行占比、AI 删除数或 human follow-up 代替接受率。官方产品页描述「修改 AI 代码」能力不等于 Developer API 公开了接受率字段。[AI overview](https://wakatime.com/) |
| AI 代码保留率 / rework rate | 当前不可取 | 当前字段没有「某行最初由 AI 产生、随后由人修改/删除」的持久 lineage | `ai_deletions / ai_additions` 也不能回答保留率，因为删除的对象来源未知。 |
| 代码质量、缺陷率、交付速度提升、ROI | 当前不可取（仅凭 WakaTime） | 需要 repo/CI/issues/PR/业务价值与因果设计 | WakaTime 的时间/行/token/成本不能单独证明生产率或质量。 |

### AI 数据产生机制与覆盖风险

- WakaTime 官方 CLI 当前默认会解析 Claude、Codex、Cursor 等 AI transcript session logs，寻找 AI 读取/编辑项目文件的活动；`sync_ai_disabled=true` 会关闭这项检测。[官方 wakatime-cli USAGE](https://github.com/wakatime/wakatime-cli/blob/develop/USAGE.md#settings-section)
- 官方产品页列出的工具覆盖 Claude Code、Codex、Continue、Cody、Roo Code、OpenCode、Copilot、Cursor、Windsurf、Qoder、Kiro、Cline、Gemini、Pi、Goose 等，但真实字段仍取决于具体 plugin / transcript 是否提供模型、token、session 等信息。[官方 AI overview](https://wakatime.com/)
- 因此 0 / null 必须区分：0 可能是真的没有 AI 活动，也可能是工具未被支持、同步被禁用、旧数据缺字段或套餐未开放。Landing DTO 应提供 `aiAvailable` / `coverageNote` 一类状态，不把缺失强制归零。

## 鉴权、套餐与数据约束

### 鉴权与 scope

- OAuth 2.0 是官方建议的应用接入方式；服务端用 `Authorization: Bearer ...`。个人自用也可用 API Key，经 HTTP Basic Auth（Base64 后）或 query 参数传递，但 query 形式更容易进入日志，应避免。[官方 Authentication](https://wakatime.com/developers#authentication)
- 公开网页绝不能携带 API key/access token。Applog 应由 NestJS 服务端取数并只返回白名单公开快照；如果必须前端直连，只能使用 WakaTime 后台创建、可撤销的 embeddable JSON/SVG URL。[官方 Security](https://wakatime.com/developers#introduction)
- MVP 最小 scope：
  - 只要 7/30 天聚合与热力图：`read_summaries`，更严格时可申请 `read_summaries.categories,read_summaries.languages,read_summaries.editors`；
  - 累计时间/Stats：`read_stats` 或对应 `read_stats.*`；
  - Goals：另加 `read_goals`；
  - 只有做单日时段环/原始派生才用高权限 `read_heartbeats`。
- token 限制：每 app 每用户最多 8 个 active OAuth token；新 token 每用户每小时最多 10 个；authorization-code token 365 天，implicit token 12 小时，应复用/refresh/revoke。[官方 OAuth Limits](https://wakatime.com/developers#authentication)

### 套餐 / 历史范围

| 官方明确说明 | 可以安全下的结论 |
|---|---|
| `all_time_since_today` 明确写「available even for Free accounts」 | 累计总时长可作为 Free fallback。[API](https://wakatime.com/developers#all-time-since-today) |
| Pricing：Free 1 周 dashboard history，Basic 2 周，Premium complete history + AI adoption/model/spend + AI-vs-human insights | AI 丰富展示按 Premium 设计；Free/Basic UI 历史长度有限。[Pricing](https://wakatime.com/pricing) |
| Stats/Insights：Free 账户请求 >= 1 年范围时，会在首次请求后台更新 | API 长范围并非简单等同 dashboard history；需检查 `is_up_to_date` 后重试。[Stats](https://wakatime.com/developers#stats) [Insights](https://wakatime.com/developers#insights) |
| FAQ：Free 数据永久保存；Premium/Team 解锁历史；同时 Pricing FAQ 又称 Free 可经 embeddables/badges/data export 查看/导出许多数据 | 官方页面对「存储、dashboard 解锁、API/导出可见」口径并非一个维度，不能推断每个 endpoint 的 Free 响应字段。[FAQ](https://wakatime.com/faq) [Pricing](https://wakatime.com/pricing) |

**接入前必须实测：** 用目标账号分别请求 `stats/last_30_days`、`insights/ai_days/last_30_days`、30 天 Summaries 和 User Agents，记录 HTTP 403、空/缺失 AI 字段、202/`is_up_to_date=false`；将「套餐不支持」与「暂无活动」分为不同状态。当前官方文档没有 endpoint × plan 的完整权限矩阵。

### 速率、缓存、时间、分页

- 官方速率阈值是任意 5 分钟平均少于 10 requests/sec；过载可返回 429，某些场景会返回 302 并表现为 timeout。Landing 不应在访客请求时逐日打 WakaTime，应定时刷新/缓存。[官方 API Introduction](https://wakatime.com/developers#introduction)
- Stats、Insights、All Time 可返回 202 或 `is_up_to_date=false` 并后台计算；Status Bar 只走缓存且首次可能为空。建议 last-known-good snapshot + `stale=true`，后台重试而非阻塞 Landing。
- Summaries/Durations/Heartbeats 按用户时区或请求 `timezone` 切日，返回 Olson/IANA timezone。所有日历键应以配置时区解释，不用服务器 UTC 日期。
- Durations/Summaries 的时长通过相邻 heartbeats 合并，默认 keystroke timeout 15 分钟且可由账户设置/参数改变；它是「活跃编码估计」，不是计费工时。[官方 FAQ：accuracy](https://wakatime.com/faq) [Durations](https://wakatime.com/developers#durations)
- 分页不是全局统一：Leaders/Commits/Org 等明确有 `page` 和 total/next/prev；Goals 响应有 `total_pages` 但当前 GET 参数未写 `page`；Projects、User Agents、Summaries 当前文档未给 pagination。不要给所有 endpoint 机械加 `page`。
- Summaries 当前文档支持预设至 Last 30 Days/Last Month，也允许 `start/end`，但没有公布最大跨度；年度热力图需实测单次跨度，必要时后端按月分片且限速。

## 数据分层与隐私最小化

### 可直接进入公开白名单快照的原始聚合字段

- 时间：7/30 天 `totalSeconds`, `dailyAverageSeconds`, `activeDays`, `bestDay`（可只保留 weekday，不保留精确日期）。
- 日级：`date`, `totalSeconds`, AI/human line-change counts or percentages；最多 365 个点。
- Top N：language/editor/category 的规范化 `name`, `seconds`, `percent`；其余合并为 Other。
- AI：聚合 AI/human line changes、Top 3 model lines；可选 token/prompt/session totals。成本默认不公开。
- 新鲜度：`fetchedAt`, `sourceModifiedAt`, `stale`, `aiAvailable`, `range`, `timezone`。

### 可安全派生指标

| 派生指标 | 公式 / 口径 | 公开条件 |
|---|---|---|
| 活跃天数 | 日 Summary `total_seconds > 0` 的天数 | 可公开；不要用来做道德评价 |
| 当前连续活跃 | 从本地日历今日/昨日向前连续 `>0` | 今日尚未编码时允许从昨日开始，文案明确 |
| AI 行变更占比 | AI change / (AI + human change) | 分母 >0；不得简称 AI 代码占比 |
| 语言/编辑器 Top N | seconds 降序，前 3，其余 Other | 单项过小可并入 Other，避免暴露罕见栈 |
| 周内节奏 | 按 weekday 聚合日编码秒数 | 建议至少 28 天样本 |
| 24h 热力环 | Duration 按当地小时分桶 | 至少 14/30 天；不展示精确开始/结束时间 |
| Prompt 密度 | 官方 avg per session，或 prompts/sessions | sessions >0；只描述互动频率 |
| Token/AI change | (input+output tokens)/AI line changes | AI changes >0；标注估算 |
| 成本/AI change | estimated cost/AI line changes | 仅本人明确开启；标注估算、非账单/ROI |

### 不应进入公开响应的字段

- 凭证：API key、OAuth access/refresh token、app secret、embeddable 管理 URL。
- Heartbeat / entity：绝对或相对文件路径、URL/domain、精确 timestamp、cursor position、line number、raw `ai_session` ID。
- 项目上下文：默认不公开 project/repository/branch/commit hash/message；只有显式 allowlist 后输出稳定 alias 和公开 URL。
- 机器/网络：machine hostname、IP、machine ID、原始 user-agent、plugin patch version。
- 人员：email、owner/shared/subscriber、leaderboard/org member 资料。
- 财务/订阅：`ai_subscription_plan`、每模型/项目成本默认私有；若展示成本只能用区间或本人开关。
- 小样本：极少使用的依赖/语言/模型可能暴露工作内容；Top N 前先设阈值（例如至少 10 分钟或 3 次 AI session）。

WakaTime 官方说明插件不上传源代码，但会发送文件路径、项目/分支、依赖、行数/光标、AI/human 行变更、token/prompt 长度、subscription plan、session ID、hostname 等元数据，所以「没有源码」不等于「可以原样公开 API」。[官方 Features](https://wakatime.com/features) 官方也提供 `hide_project_folder`, `hide_project_names`, `hide_branch_names`, `hide_file_names`, `exclude`, `include_only_with_project_file` 等客户端隐私配置；建议在数据发送前就最小化，而不是只靠 Landing 隐藏。[官方 FAQ](https://wakatime.com/faq)

## Landing 展示方案

### 推荐信息架构

建议把 WakaTime 放在「Recent Posts」之后、运动/学习区之前或与二者并列为「最近在创造什么」。不要把它设计成团队绩效仪表盘；核心叙事是：**最近投入 → 与 AI 如何协作 → 长期节奏 → 技术偏好**。

| 指标 / 组件 | 视觉形式 | 数据与文案 | 移动端退化 | 隐私处理 | 优先级 |
|---|---|---|---|---|---|
| 最近 7/30 天编码 | 3 个安静指标卡 | 总时长、日均、活跃天；数字 + 极短同比/范围说明 | 横向 3 卡变 2×2 或一行横滑；不做巨型数字 | 纯聚合 | P0 |
| 年度 Code Pulse | GitHub 风格热力图，但每格可双通道 | 亮度=当日编码时长；小角标/色相=AI 行变更占比；tooltip 写「2h 18m · AI 行变更 36%」 | 独立横向滚动并默认定位本周；或退化最近 12 周 | 只日级总量；隐藏项目/文件 | P0（Free 可先 30 天） |
| Human × AI Co-creation | **双层热力环 / donut** | 外环=AI/human 行变更比例；内环=AI Coding 时间/其他活动时间；中心只写「AI 行变更 34%」 | 单一 donut，详细 legend 下置 | 明确不是当前代码 AI 占比/接受率 | P0（AI 可用时） |
| 技术栈谱带 | Top languages/editors 横向 stacked ribbon | 宽度=时间占比；语言与 editor 分两行；Other 合并 | 单列条形图，Top 3 | 不显示 dependency；稀有项阈值过滤 | P0 |
| 今日状态 | 小型 status pill + sparkline | 「今天 1h 42m · 最后更新 8 分钟前」 | 仅文字 pill | 不显示 last project/branch | P1 |
| 24 小时 Focus Halo | **热力环**（24 段圆环） | 每段=当地小时聚合时长；内侧短划=AI coding 活跃；突出「最常进入心流 21–23 点」 | 24 格水平热带，避免小圆环难读 | 30 天聚合；不显示单日精确作息 | P1 |
| AI Model Orbit | **模型轨道 / 行星图** | 中心=总 AI changes；行星大小=模型行变更，轨道半径=token/change，描边=估算 cost | 排名列表 + 微型条形，保留相同排序 | Top 3；小样本并为 Other；成本默认关闭 | P1 |
| Prompt Rhythm | 珠链 / 节拍器 sparkline | 每日珠大小=prompt events，间距/颜色=session 数或 avg prompt length；文案「更像结对对话，而非自动补全」只能作描述，不作质量判断 | 14/30 根竖线 sparkline | 只公开次数/长度，不公开 session ID/prompt 文本 | P1 |
| AI Efficiency River | 三条细流 / slope chart | 周级 AI changed lines、tokens/change、estimated cost/change；只表现趋势 | 3 行 sparkline + 当前值 | 成本需 opt-in；小样本显示「数据不足」 | P2 |
| Project Constellation | 可控星群 | allowlisted 公开项目为星体；大小=时间，光晕=AI change share，点击到公开 repo/文章 | 有序项目列表 | 只允许显式 alias + public URL；不输出 Other 项目名 | P2 |
| Goal Arc | 目标进度弧 | `actual_seconds / goal_seconds`，显示当前 day/week status | 线性 progress bar | 剥离 owner/subscriber/shared data | P2 |
| WakaTime Universe Benchmark | 「你 vs 全站中位数」双刻度 | 个人周日均与 `/stats/last_7_days` median；只作上下文，不显示排名 | 一条双刻度线 | 全站匿名聚合；提示口径差异 | P2 |
| Leader rank | 低调 badge | 仅本人 opt-in 的 time/AI rank | 纯文本 | 不能带其他用户资料 | 不推荐默认 |

### 设计细节

- **颜色语义**：Human 用稳定的 Carbon/Ash，AI 用单一 Link Blue→Violet 渐变；不要给每个模型一套高饱和 SaaS 色。时间强度用同色亮度，AI share 用色相/角标，避免同一通道编码两个变量。
- **可访问性**：每个热力格/环段有可读 label；颜色之外同时给数字/纹理；支持 reduced motion。空值显示「AI 数据未覆盖」而不是 0%。
- **诚实文案**：使用「编码活动」「行变更」「估算 token/成本」，避免「生产力」「AI 写了我的 X% 代码」「节省 X 小时」。
- **性能**：年度热力图用原生 CSS grid/SVG；环与 sparkline 用少量 SVG，无需引入重型图表库。服务端每天/每 30 分钟刷新一份紧凑 snapshot，访客只读本地 API。

## 推荐版本

### MVP：Coding Pulse（推荐先做）

数据请求：

1. `Summaries` 最近 30 天（或套餐允许的最大范围）：日时长、AI/human change、Top language/editor。
2. `Stats/last_30_days`：总时长、日均、AI 模型总量；如 AI 字段不可用则完全隐藏 AI 子区。
3. `all_time_since_today`：累计时间 fallback。

展示：

- 标题「最近在写」+ 7/30 天总时长 / 日均 / 活跃天指标卡；
- 最近 30 天热力图（Premium/长期缓存后扩到 365 天）；
- AI 可用时显示 Human × AI 双层热力环，中心明确写「AI 行变更占比」；
- Top 3 languages + Top 2 editors 谱带；
- `fetchedAt/stale` 小字；第三方失败或未配置时整段隐藏。

MVP 不需要 `read_heartbeats`，不公开 project、dependency、machine、cost、prompt/token，也不承诺 acceptance rate。这样既符合最小权限，也与 Applog 现有 Landing 的独立降级模式一致。

### 进阶：AI Craft Observatory

前提：目标账号确认 Premium AI fields 可用；管理员显式开启每个敏感模块。

- `Insights/ai_days/last_6_months`：AI 双变量年度热力图；
- Stats/Summaries：AI Model Orbit、Prompt Rhythm、token/change；
- Durations（后台每天抓取、只保留小时桶）：30 天 Focus Halo；
- allowlisted project aliases：Project Constellation；
- optional estimated cost：只显示模型间相对分布或范围，不默认显示美元总额；
- Aggregate Stats：提供匿名全站中位数参照，不做排行榜式绩效判断。

进阶版仍不展示 raw heartbeat/entity/session、prompt text、acceptance/retention/quality/ROI 推断。

## 建议的公开 DTO 草案（非生产代码）

这是字段边界建议，不代表本任务要实现：

```text
IWakaTimeLandingStats
  range: { startDate, endDate, timezone }
  summary: { totalSeconds, dailyAverageSeconds, activeDays, allTimeSeconds? }
  days[]: { date, totalSeconds, aiChangeShare? }
  languages[]: { name, seconds, share }
  editors[]: { name, seconds, share }
  ai?:
    { changeShare, aiChanges, humanChanges, sessions?, promptEvents?,
      avgPromptLength?, inputTokens?, outputTokens?, models[]: { name, changes, share } }
  fetchedAt
  stale
```

明确不放入 DTO：project/entity/branch/repository/commit/machine/user-agent/session ID/subscription plan/cost（除非另有显式 opt-in 契约）。

## Applog 内部文件与代码模式

### Files found

| 文件 | 一句话说明 |
|---|---|
| `packages/frontend/src/pages/Landing/index.vue` | Landing 目前并列加载 Garmin、Duolingo 等独立区块，并在数据为 null 时隐藏。 |
| `packages/frontend/src/pages/Landing/hooks/useLandingDuolingoStats.ts` | 第三方失败折叠为 null，不影响页面其他请求。 |
| `packages/frontend/src/pages/Landing/hooks/useLandingGarminStats.ts` | 相同的独立 fetch / soft degradation 模式。 |
| `packages/common/src/types/duolingo.ts` | 定义 Landing 唯一公开的聚合白名单 DTO，不含账号/JWT/第三方原始对象。 |
| `packages/common/src/types/garmin.ts` | 明确公开 allowlist 与坐标、账号、原始 payload 等禁区。 |
| `.trellis/spec/backend/backend/duolingo-guidelines.md` | 规定后端归一化、缓存、stale fallback、null 隐藏与热力图可访问性。 |
| `.trellis/spec/backend/backend/garmin-guidelines.md` | 规定 worker/cache → 公共快照、敏感字段边界与 Landing 移动端呈现。 |

### Code patterns

- Landing 已通过 `v-if="loading || stats"` 在加载时保留 skeleton、无数据后整段隐藏：`packages/frontend/src/pages/Landing/index.vue:97`、`:102`。
- 第三方请求失败不冒泡到整页，hook 将无数据折叠成 `null`：`packages/frontend/src/pages/Landing/hooks/useLandingDuolingoStats.ts:5`、`packages/frontend/src/pages/Landing/hooks/useLandingGarminStats.ts:5`。
- 现有公开 DTO 采用明确白名单并写出禁区：`packages/common/src/types/duolingo.ts:27`、`packages/common/src/types/garmin.ts:80`。
- Duolingo 规范已有「30 分钟成功缓存、stale-while-refresh、首次失败返回 null」成熟模式：`.trellis/spec/backend/backend/duolingo-guidelines.md:40`。
- Garmin 规范要求公共 API 永不在请求期直连第三方，并只返回 allowlisted snapshot：`.trellis/spec/backend/backend/garmin-guidelines.md:5`、`:104`。

## Related specs

- `.trellis/spec/frontend/frontend/index.md`
- `.trellis/spec/frontend/frontend/component-guidelines.md`
- `.trellis/spec/frontend/frontend/directory-structure.md`
- `.trellis/spec/frontend/frontend/quality-guidelines.md`
- `.trellis/spec/backend/backend/duolingo-guidelines.md`
- `.trellis/spec/backend/backend/garmin-guidelines.md`
- `.trellis/spec/guides/cross-layer-thinking-guide.md`

## 建议的上线前 API 验证清单

1. 确认账户 plan 与 AI dashboard 权限；对 `Stats`, `Summaries`, `Insights/ai_days`, `User Agents` 保存脱敏 fixture。
2. 验证 AI 字段的 null/0/缺失三态，以及没有 AI transcript 支持时的响应。
3. 验证 `Insights/ai_days` 的实际 payload 结构（官方只概述语义，没有在 example 中展开具体子字段）。
4. 验证年度 Summaries 最大 date span、是否需分片、Free/Basic/Premium 的 403/裁剪行为。
5. 验证 model name 的稳定性/大小写/别名；后端只做显示归一化，不合并语义不明的模型。
6. 验证 `ai_additions/deletions` 是否存在于目标账户的历史旧数据，避免用缺失值计算 0%。
7. 确认服务器缓存、超时、202/302/429 与 last-known-good snapshot 行为。
8. 在 WakaTime 客户端先配置 `hide_project_names`, `hide_branch_names`, `hide_file_names` 或 allowlist，再开启任何公开页面。

## Caveats / Not Found

- 当前官方 live API 没有独立 `ai_agent` 聚合字段；搜索缓存中的 `ai_agent_*` 不作为契约依据。
- 没有公开的 prompt 文本、suggestion offered/accepted/rejected、acceptance rate、AI code lineage/retention、质量/缺陷/ROI 字段。
- `Insights/ai_days` 的具体 example schema 没有展开，只明确了「daily AI-vs-human line change percentages」语义；实现前需用真实响应锁 fixture。
- Summaries 的最大 start/end 跨度、Projects/User Agents 的分页上限、所有 endpoint 的精确套餐矩阵当前文档未明确。
- WakaTime Pricing、FAQ 与 Developer API 分别描述 dashboard 可见历史、数据永久保留、导出/长范围 API 后台计算，不能把其中一个页面当成全部 endpoint 的权限表。
- 官方说不上传源代码，但原始 API 仍含路径、项目、分支、依赖、机器、session 等敏感元数据；必须坚持服务端白名单快照。
