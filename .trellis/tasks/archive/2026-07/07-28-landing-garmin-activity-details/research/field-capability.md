# Garmin 字段能力矩阵（脱敏真实账号探测）

## Evidence

- 探测日期：2026-07-28
- 客户端：`garminconnect==0.3.7`，中国区账号
- 方式：使用已有加密 token 执行只读请求；仅记录字段名、类型与活动类型计数。
- 安全边界：研究产物不包含 activity id、UUID、坐标、路线、日期、地点或任何实际健康数值。
- 当前账号共 272 条活动；目标类型样本覆盖：
  - `running` 199
  - `treadmill_running` 30
  - `track_running` 15
  - `soccer` 10
  - `cycling` 5
  - `elliptical` 4
  - `stair_climbing` 1
  - `indoor_cardio` 7（账号中的“有氧运动”）

## Activity Endpoint Inventory

当前客户端提供以下只读活动端点：

| Endpoint | 能力 |
|---|---|
| activity list | 活动类型、日期、基础摘要、隐私、地点、设备提示 |
| activity summary | 完整活动摘要、训练效果/负荷、设备元数据、部分 split summary |
| activity details | 逐点 chart metrics、metric descriptors、GPS polyline |
| splits / typed splits | lap、公里/英里 split、运动类型特有 split |
| split summaries | 分段聚合指标 |
| weather | 活动天气（条件可用） |
| HR / power zones | 活动心率区间、功率区间（条件可用） |
| exercise sets | 训练动作组（主要适用于力量/结构化训练） |
| gear | 活动关联装备（条件可用） |
| GPX / TCX / FIT download | 原始活动文件；只读下载 |

## Common Activity Fields

目标类型的 summary 普遍可能包含：

- 身份/分类：活动名、活动类型、隐私规则、活动 UUID/id（仅私有采集层）
- 时间：本地/GMT 开始时间、duration、elapsed duration、moving duration
- 负荷：calories、BMR calories、训练负荷、有氧/无氧训练效果及文案
- 心率：平均/最大/最小心率
- 身体影响：Body Battery 变化、强度分钟、估算补水/汗液损失
- 运动量：距离、平均/最大速度、步数（依运动与设备）
- 元数据：设备/传感器、文件格式、lap 数、是否有 chart/polyline/split

所有字段均为条件可用；同步不得用 `0` 替代缺失。

## Per-Type Capabilities

| 活动 | Garmin type | 当前样本确认的逐点/高级能力 | 适合详情层优先展示 |
|---|---|---|---|
| 户外跑步 | `running` | GPS、速度、海拔、心率、跑步功率、步频、步幅、触地时间、垂直振幅/比率、坡度调整速度、气温、表现状态、lap/split | 距离、用时、配速、心率、海拔、步频、功率、训练效果；跑姿指标作为次级 |
| 操场跑步 | `track_running` | 与户外跑步接近，含 GPS、圈/分段、功率与跑姿指标 | 距离、用时、配速、圈数/分段、心率、步频、功率 |
| 跑步机 | `treadmill_running` | 无 GPS；速度、心率、功率、步频、步幅、触地时间、垂直振幅/比率 | 距离、用时、配速、心率、步频、功率、训练效果 |
| 足球 | `soccer` | GPS、速度、心率、步频、Body Battery、距离；无跑步高级姿态指标 | 用时、移动距离、心率、最高速度、消耗、训练效果 |
| 骑行 | `cycling` | GPS、速度、海拔、垂直速度、心率；当前样本未返回功率/踏频 | 距离、用时、速度、心率、爬升、训练效果；功率/踏频仅有数据时显示 |
| 椭圆机 | `elliptical` | 无 GPS；心率、Body Battery、步频、时长/移动时长、设备距离 | 用时、心率、步频、消耗、训练效果；距离不作为主指标 |
| 有氧运动 | `indoor_cardio` | 无 GPS；心率、Body Battery、时长/移动时长、设备距离 | 用时、心率、消耗、训练效果、Body Battery 变化 |
| 爬山机 | `stair_climbing` | 无 GPS；心率、Body Battery、步频、时长/移动时长、设备距离 | 用时、心率、步频、消耗、训练效果 |

## Daily Health Endpoint Inventory

| 数据域 | 当前真实响应结构 | 状态 |
|---|---|---|
| Body Battery | 日期、起止时间、充入/消耗、值序列、活动/反馈事件 | 已确认 |
| 全天压力 | 日期、平均/最高压力、压力序列、Body Battery 序列 | 已确认 |
| 睡眠 | daily sleep summary、睡眠阶段、REM、睡眠活动 | 已确认 |
| HRV | HRV summary、读数序列、睡眠起止 | 已确认 |
| 血氧 | 日均/睡眠/最低/最近值、连续/小时/单次序列 | 已确认 |
| 呼吸 | 清醒/睡眠均值、最高/最低、全天序列 | 已确认 |
| 补水 | 目标、摄入、活动摄入、汗液损失 | 已确认 |
| 强度分钟 | 中高强度分钟、周累计、目标 | 已确认 |
| 身体组成 | 日期范围、体重记录、聚合 | 已确认 |
| 全天心率 | 客户端有按日端点；本次采样返回连接错误 | 条件可用，需容错/复测 |
| 步数 | 客户端有日明细及范围端点；本次采样返回连接错误 | 条件可用，亦可从日摘要补充 |
| 静息心率 | 客户端有按日端点；本次采样返回连接错误 | 条件可用，需容错/复测 |

## Planning Consequences

- “所有明细”应落到私有采集模型；公开 Landing DTO 继续显式挑选字段。
- 活动原始响应、结构化 summary、lap/split 和逐点序列应分层保存，避免单表无限加列。
- 逐点序列体积最大，应压缩存储并用 activity id + metric key + timestamp/index 幂等定位。
- 健康数据应以 Garmin 的 `calendarDate` 和本地/GMT 时间戳共同保存，不能只按服务器 UTC 日归档。
- 单个 endpoint 失败不得回滚同日或同活动的其他数据域；同步状态需要按数据域记录游标与错误。
- 字段能力来自非官方接口和当前设备，必须保留 schema/version/抓取时间，后续响应变化可重新解析。
