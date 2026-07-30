# 解析 Garmin 室内运动详情数据

## Goal

让已归档的跑步机、椭圆机、室内有氧和爬楼机活动能够从 Garmin 原始载荷中稳定提取通用指标与运动类型特有指标，并安全回填到现有详情模型和公开 allowlist，而不是“原始数据已抓取、归一化字段仍为空”。

## Confirmed Evidence

- 当前私有索引包含跑步机 27 条、室内有氧 7 条、椭圆机 4 条、爬楼机 1 条；18 条已有公开快照，4 条完成过详情抓取。
- 已完成详情抓取的跑步机、室内有氧和椭圆机活动均归档了 `summary`、`details`、`splits`、`typed_splits`、`split_summaries`、`hr_zones`、`power_zones`、`gear`、`weather` 和 FIT。
- `normalize_activity_detail()` 当前从载荷顶层读取 `averageHR`、`averageSpeed` 等键，但实际 Garmin `summary` 把这些指标放在 `summaryDTO` 下；这是详情指标全部为空的直接原因。
- 已验证的跑步机载荷含移动时长、平均/最高速度、平均/最高心率、跑步步频、平均/最高功率、训练效果、无氧训练效果、训练负荷、Body Battery 变化、步数和分段指标。
- 已验证的室内有氧载荷含移动时长、速度、平均/最高心率、训练效果、无氧训练效果、训练负荷、Body Battery 变化、步数和圈段指标。
- 当前环境无法认证解密两条较早的椭圆机详情载荷（`InvalidTag`）；本任务通过 Garmin 有界重抓并认证覆盖，不绕过 AEAD，也不把它误判为字段缺失。
- 原始载荷和位置属于私有数据；调试、测试 fixture 和日志只能保留字段结构与脱敏合成值。

## Requirements

### R1. Shape-aware normalization

- 支持 Garmin 当前 `summaryDTO` 嵌套结构，同时保留对现有顶层合成 fixture/旧结构的兼容。
- 明确字段优先级、数值合法性、零值保留和空值语义，禁止用错误类型或默认零伪造指标。
- 分段数据从 `lapDTOs`、typed splits 或 split summaries 中选择一个稳定来源，避免重复或含义混淆。

### R2. Common and type-specific metrics

- 通用详情至少覆盖移动时长、平均/最高心率、训练效果、Body Battery 变化与圈/分段信息。
- 跑步机按载荷能力补充速度/配速、跑步步频、步数、功率、无氧训练效果与训练负荷。
- 室内有氧、椭圆机和爬楼机只发布源数据明确提供且语义可靠的指标，不从距离或热量反推不存在的数据。
- 公开详情新增 nullable 的 `anaerobicTrainingEffect`、`activityTrainingLoad` 和 `steps`；前端按运动类型择优展示，无值时隐藏。

### R3. Privacy and compatibility

- 继续通过 worker 私有解密边界读取原始载荷，公开 API 只返回明确 allowlist 的归一化指标。
- 不把真实活动 payload、活动 ID、坐标、时间或密钥写入 Git、测试输出或日志。
- 现有公开详情字段保持向后兼容；新增的无氧训练效果、训练负荷和步数均为 nullable，并允许旧活动分批回填。

### R4. Backfill and observability

- 提供有界、可重入的详情重解析/重抓机制，不需要重新下载所有 Garmin 历史活动。
- 历史载荷认证失败时，将对应活动重新加入详情抓取队列；成功抓取全部可用域后以当前 Key 覆盖，单条失败不阻断批次。
- 区分“未抓取”“载荷缺字段”“解析失败”“无法解密”和“回填成功”，避免继续以全空详情标记完成。
- 回填不得改变活动公开状态、封面或原始加密载荷。

## Acceptance Criteria

- [x] AC1：真实结构的脱敏 fixture 证明 `summaryDTO` 中的移动时长、心率、速度、步频、功率、训练效果、训练负荷和 Body Battery 等字段能按规则归一化。
- [x] AC2：跑步机、室内有氧、椭圆机和爬楼机各有类型覆盖测试；缺失指标保持 `null`，数值零不被当作缺失。
- [x] AC3：分段来源与优先级有测试，最多公开 12 段且不会重复同一圈段。
- [x] AC4：公开详情只增加批准的 nullable 字段，原始 payload、坐标、内部 ID 和密钥不泄露。
- [x] AC4a：公共类型、后端 allowlist 与前端指标配置一致支持无氧训练效果、训练负荷和步数；无值时不展示。
- [x] AC5：有界回填后，当前可解密的室内详情不再出现“原始 summary 有指标但归一化详情全空”；重复执行不产生不一致结果。
- [x] AC6：历史 `InvalidTag` 数据得到明确处理结果，不因单条不可解密阻断其他活动。

## Out of Scope

- 根据设备模型估算 Garmin 未提供的生理或运动指标。
- 在前端展示原始 FIT、心率采样序列、功率采样序列或完整 Garmin payload。
- 本任务不修改地图封面、腾讯地图链路或活动公开隐私规则。
