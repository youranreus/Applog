# Garmin 今日健康字段可用性核查

## Evidence date

2026-07-30（Asia/Shanghai）

## Production snapshot coverage

对 `garmin_health_daily` 最近 4 日做只读覆盖率检查（仅统计非空，不读取公开输出原始值）：

| Field | Coverage | Finding |
|---|---:|---|
| averageStressLevel | 4/4 | 可用 |
| bodyBatteryCharged / Drained | 4/4 | 可用 |
| steps / stepGoal | 0/4 | endpoint 调用失败，不是设备无数据 |
| restingHeartRateBpm | 0/4 | endpoint 调用失败，不是设备无数据 |
| moderate / vigorous intensity | 0/4 | payload 可用，但归一化别名错误 |
| sleepScore | 0/4 | 当前 payload 不提供该字段 |
| sleepSeconds | 部分可用 | 最新日可用，历史日不稳定 |

## Root causes

1. `GarminReadAdapter` 只调用 `client.loads(token)`，没有执行库的标准 token 恢复/profile 初始化；`display_name` 保持为空。
2. `get_steps_data` 和 `get_rhr_day` 要求已初始化的 `display_name`，因此当前 worker 在真正请求前就失败。
3. 强度分钟真实字段为 `moderateMinutes` / `vigorousMinutes`，当前 `_HEALTH_METRICS` 只查找 `moderateIntensityMinutes` / `vigorousIntensityMinutes`。
4. 身体电池归档数据已有 `bodyBatteryValuesArray` 与动态反馈 `bodyBatteryLevel`；统一 daily summary 还直接提供 `bodyBatteryMostRecentValue`。
5. 当前 sleep payload 只有时长、分期、睡眠需求等字段，没有 sleep score；daily summary 同样没有 score。
6. `_archive_health_days` 使用 `synced_at.date()`（UTC）选择今天/昨天，Asia/Shanghai 凌晨存在自然日错位风险。

## Low-request validation

使用现有 token 执行标准 profile 初始化，然后只读调用一次当日 `get_stats`：

- profile 初始化成功；
- `totalSteps`、`dailyStepGoal`、`restingHeartRate`、`moderateIntensityMinutes`、`vigorousIntensityMinutes` 均存在且非空；
- summary 同时存在 `bodyBatteryMostRecentValue`；
- 不存在睡眠评分字段。

## Recommended data contract direction

- worker 用标准 token 恢复/profile 初始化流程，不能只 `loads` token。
- 将统一 daily summary 纳入健康归档，作为步数、目标、静息心率、强度分钟、当前身体电池的首选来源；独立 domain 作为补充/回退和可用性证据。
- Garmin 本地日必须显式按配置时区计算，不使用 UTC `date()` 代替。
- 评分只接受实际观测值；sleep score 缺失时不得从睡眠时长伪装或臆造 Garmin 分数。
- 增加字段覆盖率/域失败的隐私安全日志或健康检查，以便长期缺失可观测。
