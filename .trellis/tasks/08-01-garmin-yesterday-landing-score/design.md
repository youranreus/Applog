# Garmin yesterday landing score — Technical Design

## Architecture and boundaries

数据流保持不变：

`Garmin Connect → Python worker → garmin_health_daily → NestJS allowlist → @applog/common → Vue Landing`

- Worker 继续负责 Garmin 本地今天/昨天刷新和历史游标回填。
- NestJS 只读取已落库的昨日快照，不在公开请求中访问 Garmin。
- `summaryData` 保持私有；公开字段白名单不扩大。
- 服务端负责确定性评分，前端只展示指标、分数和状态动画。

## Worker ingestion

现有 `_archive_health_days` 已满足采集需求：

- 使用 `GARMIN_TIME_ZONE` 计算本地自然日。
- 每轮刷新今天和昨天。
- `health:daily` 游标逐日回填更早历史。
- `calendarDate` 唯一键 upsert，重复同步幂等更新同一天。

本任务不改变采集逻辑。测试需保留或强化“今天 + 昨天刷新”和日期唯一 upsert 的证据，防止读取端迁移时误以为需要新增采集流。

## Public contract

将今日语义迁移为昨日语义：

- `GET /garmin/yesterday`
- `IGarminYesterdayStatus`
- `IGarminYesterdayMetrics`
- `IGarminYesterdayEvaluation`
- `GarminYesterdayStatus`
- `GARMIN_YESTERDAY_STATUS`

状态字符串本身保持不变，因此角色动作映射的可见行为不变。删除仓库内 `/garmin/today` 调用及 Today 类型/函数命名，避免形成双重语义。

服务端通过配置时区得到本地今日，再减一天生成查询日期。查询必须精确匹配该日期；缺失时返回 `null`，不寻找最近一条。

## Evaluation

复用现有权重、阈值、缺失维度和置信度规则，仅移除日内进度折算：

- 睡眠：25
- 身体电池：25
- 反向压力：20
- 全天步数完成率：15
- 全天强度完成率：15

步数使用 `steps / stepGoal`，强度使用 `intensityMinutes / 30`，均 clamp 至 0–100。相同指标在任意请求时刻得到相同评分。`evaluatedAt` 仍记录实际服务端评估时刻，但不参与得分。

建议将纯函数命名为 `evaluateGarminYesterday(metrics, evaluatedAt)`；本任务不保留 `localHour` 参数。

## Freshness

- `fetchedAt` 使用昨日行的 `updatedAt`。
- `stale` 保持既有规则：全局同步非 healthy，或昨日行更新时间距当前超过六小时。
- 昨日数据在自然日结束后通常不会再变化，但 freshness 仍表达 worker 是否成功刷新该最终快照。

## Frontend

同步重命名：

- `useLandingYesterdayStatus`
- `LandingYesterdayStatus`
- 组件局部类名和测试描述使用 yesterday 语义。

展示文案切换为“昨天，活得怎么样？”和“昨日回顾”等明确语义。六项指标、综合分数、角色动作、loading、stale、error、empty 均消费同一 Yesterday DTO。布局和 Sprite Sheet 资源不改变。

## Compatibility and rollback

- 数据库和 worker 无 schema 变更。
- 后端、common、frontend 必须在同一版本发布，避免端点和类型不匹配。
- 回滚可恢复旧端点/前端调用；历史日快照无需回滚。
- 当前仓库没有 `/garmin/today` 的其他消费者，因此不保留兼容别名。
