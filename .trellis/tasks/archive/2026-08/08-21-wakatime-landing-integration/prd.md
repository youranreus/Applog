# Implement WakaTime Landing integration

## Goal

在 Applog Landing 增加一个可独立降级的 WakaTime 区块，让访客理解站点作者近期的编码投入、技术偏好和 AI 协作方式，同时公开展示 token 消耗量与 WakaTime 估算成本，但不暴露凭证、项目、文件、分支、机器或 session 明细。

用户价值：将“最近在创造什么”从单纯时长扩展为编码节奏、技术栈和 AI 使用方式，并保持指标口径诚实、隐私边界明确。

## Background

- 2026-08-21 的官方资料与目标 Free 账号 live API 验证记录在 `docs/research/wakatime-landing-data.md`。
- 目标账号实测可读取 7/30 天 Stats、30 天 Summaries、All Time、Status Bar、User Agents、Durations 与 Heartbeats；`Insights/ai_days` 返回 402。
- Stats/Summaries 在 Free 账号上实际包含 AI/human additions/deletions、模型、input/cached-input/output token、prompt、session 和估算成本字段。
- 30 天 Stats 首次可能返回 202，稍后重试为 200；但目标账号实测 30 天 Summaries 单端点已覆盖 MVP 所需字段，因此 MVP 不依赖 Stats 或付费 Insights。
- Applog 已有 Duolingo 的 admin secret 配置、服务端归一化、30 分钟缓存、single-flight、stale-while-refresh 和 Landing 软降级模式；WakaTime 应沿用同类边界，不在浏览器直连第三方。

## Requirements

- R1：新增服务端 WakaTime HTTP 边界，通过服务端持有的 API key 调用官方 API；公开响应、日志和错误不得包含 API key、Authorization header 或第三方完整 payload。
- R2：新增管理员可读写的 WakaTime 配置，至少包含 masked API key、IANA 时区和 Landing 展示开关；保存后无需重新构建前端。`~/.wakatime.cfg` 仅用于本次本地验证，不作为生产运行时依赖。
- R3：服务端以最近 30 天 Summaries 作为 MVP 唯一统计数据源，归一化一份白名单 Landing snapshot；访客请求只读取缓存/快照，不接触凭证或第三方原始对象。7 天指标从同一批日项截取，避免额外请求。
- R4：公开区块位于 Landing Slogan 正上方，以 `range.startDate` / `range.endDate` 展示统计周期；不展示抓取更新时间。
- R5：不展示 30 天 Code Pulse 热力图；日级数据保留在公开 DTO 中供聚合与未来兼容，但当前 Landing 不使用需要额外解释的热力视觉。
- R6：不展示常用语言，也不使用独立 Model 排名表。工作环境 / 工具与 AI 模型作为同一大卡底部的两组用量 tags，按占比降序；桌面约按 3:2 分配空间，tag 保留百分比文本，颜色只作辅助语义。
- R7：参考 `llm-usage` light widget 的信息结构，将最近 30 天数据收敛为一个浅色背景、13px 圆角、细外边框、无阴影且无内部分割线的大卡片：周期 → Token 总量与金额 → 一条分段占比条及紧凑图例 → 工作环境/工具与 AI 模型。图例统一承载 input/cached-input/output 的名称、数值和比例并以 flex 自然横排；金额不显示标题，以 `~$xx.xx` 表示估算；任一资源值缺失显示 `—`，金额真实为零时显示 `~$0.00`。
- R8：`ai_line_changes_total` 与 additions/deletions 不可混用；所有 AI 占比固定采用 R5 公式，分母为 0 或字段缺失时返回 null 而不是 0%。
- R9：成功结果缓存约 30 分钟；服务启动、配置保存和定时周期触发 single-flight 后台刷新，公共请求不直接等待 WakaTime。失败时返回当前进程内的 last-known-good 并标记 stale，首次尚未完成、配置不可用或无快照时返回 null，使 Landing 独立隐藏该区块。
- R10：公开 DTO 不包含 project、repository、branch、dependency、entity/file path、machine、raw user agent、session ID、subscription plan、账号资料或任何凭证。
- R11：Landing 组件提供 loading skeleton、空/不可用降级、stale 提示与移动端布局；删除编码时长、日均投入、活跃天数、AI 行变更占比四项摘要及相关 7 天提示。stale 只显示简短状态，不重新引入更新时间。
- R13：单卡保持紧凑信息密度：Token 总量与金额不得使用 Hero 级超大字号，卡片内边距、主区块间距、明细与 tags 应与 Landing 相邻区块的排版尺度协调，同时保留清晰层级和移动端可读性。
- R14：Token 构成只展示一次。删除占比条上方独立的 Input/Cached Input/Output 三列明细，由占比条下方的紧凑图例统一展示颜色、名称、Token 数值与比例。
- R12：后端 normalization/cache/config、公共 DTO、前端派生/格式化及关键空值、上游状态、字段缺失路径需要自动化测试。

## Acceptance Criteria

- [x] AC1：管理员可保存、更新和脱敏读回 WakaTime API key、时区和启用状态；普通用户无法读取配置，公共 API 永不返回 key。
- [x] AC2：配置有效时，公开 `GET /wakatime/stats` 返回共享类型定义的白名单 snapshot；禁用、首次失败或无可展示数据时返回 null。
- [x] AC3：WakaTime 模块位于 Slogan 正上方；页面不展示四项摘要、常用语言、抓取更新时间、Code Pulse 或独立 Model 排名表。
- [x] AC4：单个浅色大卡按“周期、Token 总量/金额、分段占比条与紧凑图例、工具/AI 模型 tags”展示；图例是三类 Token 的唯一明细入口，缺失值为 `—`，真实零金额为 `$0.00`。
- [x] AC5：429/超时、鉴权或套餐错误、第三方失败、AI 字段缺失和分母为 0 均不会影响 Landing 其他区块；有旧快照时标记 stale。
- [x] AC6：公共响应与日志通过测试证明不包含 R10 列出的敏感字段；浏览器不向 WakaTime 发请求。
- [x] AC7：单卡在桌面与窄屏可读，无页面横向溢出；占比条和 tag 颜色之外均保留文本/数值语义，并支持 reduced motion。
- [x] AC8：common build、backend unit tests/build、frontend unit tests/type-check/build/lint 通过。
- [x] AC9：单卡整体视觉尺寸较初版收紧，Token 总量和金额字号明显降低，内部留白同步压缩且无窄屏溢出。
- [x] AC10：占比条上方不再重复展示三类 Token；图例紧凑承载名称、数值和比例，并保留缺失/零值语义与可访问标签。
- [x] AC11：区块标题为小字 `AI Cost` + 大字“开发状态”；金额无标题并带 `~`；卡片无内部分割线，图例自然 flex 横排，底部分组桌面按 3:2 展示。

## Out of Scope

- OAuth 多用户授权、团队/组织 dashboard、leaderboard、data dumps、commit/PR 统计。
- 公开项目级数据、文件/分支/机器/依赖、prompt 文本、raw heartbeat 或 raw session。
- AI suggestion 接受率、代码保留率、代码质量、生产率、ROI 或“AI 写了多少现存代码”的推断。
- 直接使用付费 `Insights/ai_days`；Free MVP 使用 Summaries 派生。
- 将 WakaTime 估算成本解释为真实供应商账单。

## Key Decisions

- 公开展示统一使用快照的 30 天日期范围，不再展示 7 天趋势与四项编码摘要。
- token、金额、token 构成、工具和 AI 模型合并到一个完整大卡；金额只显示数字。
- Code Pulse、常用语言、独立 Model 排名表和抓取更新时间均移除。
- MVP 只调用 30 天 Summaries；不为已由单端点满足的需求引入 Stats 202、Insights 402、User Agents 分页或 Heartbeats 隐私面。
- WakaTime API key 采用与 Duolingo JWT 相同的管理员配置、脱敏读回和通用配置防绕过边界，不读取部署机器的 home 目录。
