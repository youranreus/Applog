# Current indoor payload shape audit

只读审计时间：2026-07-30。审计仅记录字段路径和聚合数量，不保存真实值、活动标识、时间、位置或密钥。

## Root cause

`normalize_activity_detail()` 当前从 `summary` 顶层读取指标。已归档的当前 Garmin 响应实际使用 `summaryDTO.<metric>`、`metadataDTO.<flag>`、`splitSummaries[]`、`splits.lapDTOs[]` 和 `typed_splits.splits[]`。

因此当前归一化详情为空并不代表 Garmin 没有数据，而是读取层级错误。

## Verified metric families

跑步机的 `summaryDTO` 已观察到时长、移动时长、距离、热量、平均/最高心率、平均/最高速度、平均/最高跑步步频、平均/最高功率、训练效果、无氧训练效果、训练负荷、Body Battery 变化和步数。

室内有氧的 `summaryDTO` 已观察到时长、移动时长、距离、热量、平均/最高心率、平均速度、训练效果、无氧训练效果、训练负荷、Body Battery 变化和步数。

跑步机和室内有氧的 `lapDTOs[]` 均观察到距离、时长、移动时长、平均/最高心率和速度；跑步机另外观察到跑步步频和功率字段。

## Historical decryptability

当前 Key 可认证最新跑步机与室内有氧样本。两条旧椭圆机详情载荷返回 `InvalidTag`；本任务将其加入有界详情重抓队列，以当前 Key 认证覆盖，不能绕过 AEAD 认证读取。
