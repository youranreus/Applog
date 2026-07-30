# Indoor detail reparse dry-run

只读 dry-run 时间：2026-07-30。结果只记录类型级数量和字段存在性，不包含活动标识、值、时间或位置。

## Candidate routing

| Activity type | Local reparse | Remote refetch: missing summary | Remote refetch: unreadable |
|---|---:|---:|---:|
| treadmill_running | 1 | 26 | 0 |
| indoor_cardio | 1 | 6 | 0 |
| elliptical | 1 | 2 | 1 |
| stair_climbing | 0 | 1 | 0 |

本地可重解析样本优先进入解析版本升级队列，不消耗 Garmin 请求。其余记录继续遵守每轮两个详情的既有预算。

## Verified normalized fields

- 跑步机：移动时长、平均/最高速度、平均/最高心率、步频、平均功率、有氧/无氧训练效果、训练负荷、Body Battery 变化、步数、圈数。
- 室内有氧：移动时长、平均速度、平均/最高心率、有氧/无氧训练效果、训练负荷、Body Battery 变化、步数、圈数。
- 椭圆机：移动时长、平均速度、平均/最高心率、有氧/无氧训练效果、训练负荷、Body Battery 变化、步数、圈数。

结果证明嵌套 `summaryDTO` 映射能恢复当前归一化表中全部为空的详情字段。
