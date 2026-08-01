# Garmin yesterday landing score

## Goal

让 Landing 的 Garmin 状态评分使用完整的昨日健康数据，避免当日数据尚未形成或按当前时刻折算导致分数波动，并继续只公开既有白名单健康指标。

## Background

- Garmin worker 使用 `GARMIN_TIME_ZONE`（默认 `Asia/Shanghai`）确定自然日。
- 每次同步都会刷新 Garmin 本地日期的今天和昨天；历史健康数据由 `health:daily` 独立游标逐日回填。
- `garmin_health_daily.calendarDate` 有唯一索引，同一自然日通过 upsert 更新，因此同步是增量、幂等的日快照记录，而不是仅保存最新一天。
- 当前 `GET /garmin/today` 固定读取本地今天的数据。
- 当前评分会依据本地小时动态折算步数和强度目标；昨日作为完整自然日时不应继续使用“当前小时进度”折算。

## Requirements

- 后端从 `garmin_health_daily` 读取 Garmin 本地昨日的日快照用于 Landing 评分。
- 昨日评分按完整一天计算步数和强度目标，不受请求发生时间影响。
- 继续使用现有公开指标白名单，不暴露 Garmin 原始 payload、账号信息或其他私有健康字段。
- 缺失维度、可信度和 stale 行为保持可解释，并有自动化测试覆盖日期及时区边界。
- Landing 的标题、时间语义和空状态必须与“昨日数据”一致，不能继续误称“今天”或“截至目前”。
- 整个状态区块切换为昨日回顾：角色状态、六项指标、综合分数和文案使用同一份昨日快照。
- 公开契约改为语义明确的 yesterday 命名；仓库内调用方同步迁移，不保留 `/garmin/today` 兼容别名。

## Acceptance Criteria

- [ ] 在 `Asia/Shanghai` 等配置时区下，接口读取请求时刻对应的前一个本地自然日。
- [ ] 昨日有可用快照时，返回的 `calendarDate` 是昨日，并基于全天目标稳定计算评分。
- [ ] 同一份昨日指标在一天内不同请求时刻得到相同评分。
- [ ] 昨日快照不存在时，接口返回既定的可观察空状态，不回退到不完整的今日评分。
- [ ] Landing 文案明确表达昨日状态，且 loading、unavailable、无快照状态可正常展示。
- [ ] 角色动作只消费昨日评分状态，与页面显示的昨日指标一致。
- [ ] 代码和公开契约中不再以 today 命名该功能或调用 `/garmin/today`。
- [ ] 后端服务、评分工具和前端相关测试通过。

## Out of Scope

- 修改 Garmin 上游采集域或新增健康指标。
- 改变历史回填深度、同步频率或 Garmin 凭据管理。
- 展示多日趋势或历史评分列表。
- 持久化计算后的评分；评分仍由已落库的日快照确定性计算。
- 保留旧 `/garmin/today` API 或旧 Today 命名兼容层。

## Key Decisions

- Landing 状态模块整体切换为昨日回顾，不混合今日实时数据。
- 昨日使用完整自然日目标：步数目标为配置/Garmin/default 的最终目标，强度目标为完整 30 分钟。
- 日期边界继续以 `GARMIN_TIME_ZONE` 为准。
- 新公开端点为 `GET /garmin/yesterday`，共享类型、API 方法、hook 和组件同步使用 Yesterday 命名。
- 昨日不存在时返回 `null`，不回退到今日或更早日期。

## Risks and Deferred Items

- 同步在午夜附近尚未成功刷新昨日时，Landing 会短暂显示无快照或 stale；不以今日数据填补。
- `updatedAt` 表示该日快照最后一次 upsert 时间，不代表健康事件发生时间；继续作为 freshness 判断依据。
- 多日趋势和评分持久化后续另行规划。
