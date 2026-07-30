# Garmin 室内运动详情解析设计

## Boundaries

- Garmin adapter 继续负责独立抓取各原始数据域，不改变非官方 API 调用边界。
- `normalize_activity_detail()` 是原始 Garmin shape 到稳定领域指标的唯一转换边界。
- `garmin_activity_detail` 保存可查询的私有归一化字段；公开 snapshot 的 `detailData` 只复制 allowlist。
- NestJS 只从公开 snapshot 构造响应；前端不读取私有表或原始载荷。

## Normalization contract

### Summary source

1. 当 `summary.summaryDTO` 是对象时，以它作为主要指标源。
2. 顶层 summary 仅作为旧 fixture/旧响应兼容回退，不覆盖嵌套结构中明确存在的零值。
3. `metadataDTO.lapCount` 是圈数的次级来源；有效 summary 指标优先。
4. 所有数值继续通过有限数校验；负数仅在字段语义禁止时拒绝，Body Battery delta 允许负值。

### Field mapping

| Domain field | Garmin candidates |
|---|---|
| moving duration | `summaryDTO.movingDuration` |
| average/max speed | `averageSpeed`, `averageMovingSpeed` / `maxSpeed` |
| average/max heart rate | `averageHR` / `maxHR` |
| cadence | `averageRunCadence`, then biking cadence aliases |
| average power | `averagePower`, then `avgPower` |
| aerobic training effect | `trainingEffect`, then `aerobicTrainingEffect` |
| anaerobic training effect | `anaerobicTrainingEffect` |
| activity training load | `activityTrainingLoad` |
| Body Battery delta | `differenceBodyBattery` |
| steps | `steps` |
| lap count | `lapCount`, then `metadataDTO.lapCount` |

### Splits

- 优先使用独立 `splits.lapDTOs[]`，因为它表达设备记录的真实圈段。
- 缺失时回退 `typed_splits.splits[]`，最后才使用 summary 内的 `splitSummaries[]`。
- 每段只公开 index、type、距离、时长、平均配速和平均心率，最多 12 段。
- 不合并多个来源，避免重复圈段；零距离或缺少部分指标的合法圈段仍可保留。

## Storage and public contract

- `NormalizedActivityDetail`、`garmin_activity_detail` 与 snapshot `detailData` 增加 `anaerobic_training_effect`、`activity_training_load`、`steps`。
- 数据库迁移采用 nullable 列，不为历史记录设置默认值。
- 公共 TypeScript 契约增加对应 camelCase nullable 字段。
- 前端指标注册表新增“无氧训练效果”“训练负荷”“步数”，跑步机优先展示；其他类型仅在有值且配置允许时展示。

## Bounded reparse and refetch

1. 为私有活动增加明确的详情重处理状态或可重排队机制，不通过删除活动/游标触发。
2. 优先从当前 Key 可认证的 `summary` 与 split 载荷进行本地重解析，不产生 Garmin 请求。
3. 任一必要载荷返回 `InvalidTag` 时，将该活动放入有界远程重抓队列；以现有详情批次上限逐轮处理。
4. 重抓成功后使用当前 Key 原子覆盖各成功数据域并更新归一化详情；条件端点失败保持 `partial`。
5. 单条认证或上游失败记录非敏感分类并留待重试，不推进成不可重试的 complete。

## Compatibility and privacy

- 新字段全部 nullable，旧 API 消费者可忽略；现有字段名称和含义不变。
- 不提交真实 payload fixture。测试 fixture 只复刻层级、键名和合成数值。
- 日志只记录不可逆活动指纹、阶段与错误分类；不记录原始载荷、活动 ID、时间、坐标或密钥。
- AEAD `InvalidTag` 永远视为认证失败，不尝试弱化校验或猜测旧 Key。

## Rollback

- 解析器和新增列可随应用版本回滚；nullable 列保留不会影响旧代码。
- 回填是幂等 upsert，不删除原始载荷。出现映射问题时停止重处理开关并修正解析器后重跑。
