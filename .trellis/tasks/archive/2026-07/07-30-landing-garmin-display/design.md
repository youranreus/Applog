# Landing Garmin 展示调整技术设计

## Architecture and Boundaries

沿用现有只读链路：Garmin Connect → Python worker 私有归档/公开快照 → MySQL → NestJS → `@applog/common` → Vue Landing。NestJS 不调用 Garmin，上游原始数据和坐标仍只在 worker 内处理。

本任务不新增数据库列。活动详情已作为白名单化 JSON 存在 `garmin_activity_snapshot.detailData`；NestJS 在 `GET /garmin/stats` 映射时从中挑选卡片所需的有限数值字段，避免复制存储和 schema migration。

## Public Contract

新增 `IGarminLandingActivityMetrics`，字段均为 `number | null`：

- `averagePaceSecondsPerKm`
- `averageHeartRateBpm`
- `maxHeartRateBpm`
- `averageCadencePerMinute`
- `averagePowerWatts`
- `trainingEffect`
- `steps`

`IGarminLandingActivity` 新增 `metrics`。原有距离、时长和热量仍保留在活动顶层，前端将两组数据组合成类型化展示。`metrics` 不包含 splits、最大速度、坐标或任何源 ID。后端通过统一 `numberOrNull` 边界过滤非有限值。

这是向后兼容的响应扩展；同仓库前后端和 common 必须原子部署。旧快照没有 `detailData` 时全部返回 null，前端按现有摘要字段降级。

## Worker Data Flow

- `indoor_cycling` 加入详情重解析活动类型，使已有私有归档可在 parser 流中补齐公开 `detailData`。
- 提升 detail parser version，确保已有室内骑行归档进入有界重解析。
- 保持每轮详情请求预算和归档优先策略不变；未补齐期间 UI 自然降级。
- 已有 `_public_detail` 白名单包含目标字段，无需添加原始数据字段。

## Frontend Presentation

`useLandingGarminStatsPresentation` 负责形成明确视图模型：

- `hasRoute` 只由经过安全 path 解析的 `route` 决定。
- 路线活动保留当前封面和详情弹窗入口。
- 无路线活动产生最多 5 项的 `cardMetrics`，由类型预设排序并过滤 null。

`GarminActivityCard` 使用条件根元素或等效语义分支：路线卡为 `button`，无路线卡为非交互 `article`/`div`。无路线分支不挂 click、键盘激活或详情 aria-label。保留 `usePointerTilt` 的 perspective/rotate 与既有设备、减少动态效果和复位守卫，仅从 transform 中移除 `scale(1.025)`；保留按钮焦点样式。倾斜是卡片表面的视觉反馈，不作为可点击性的唯一提示，因此两种卡片均可倾斜，但只有路线卡具有按钮语义和焦点反馈。

卡片内部拆成路线封面布局与无路线数据布局。后者不渲染 `GarminActivityCover`，标题、日期与指标在原卡片宽度中形成紧凑数据面板；空指标省略。

`indoor_cycling` 使用独立预设，踏频标签采用中性“踏频”，避免沿用跑步“步频”。

## Dialog Responsiveness

- 检查 `DialogContent` 基础 `max-width` class 与 scoped deep selector 的优先级，确保 Garmin 宽度规则真实生效。
- 双栏 grid 使用可收缩列和 `min-width: 0`；在内容所需宽度之前切换单栏，而不是固定等到 720px。
- 分段行在窄内容区允许重排或缩小列定义，长数值不能撑破容器。
- 弹窗限制在视口宽高内并保持内部纵向滚动；关闭按钮始终位于可视区域。

## Compatibility, Rollout, and Rollback

- 推荐部署顺序：common/backend/frontend 与 worker 同一版本发布；旧数据允许 null 降级。
- 无数据库迁移，回滚只需回退代码；新增 JSON 响应字段不会破坏宽容客户端。
- Worker parser 升级仍受每轮批次限制，不会在单次同步中制造无界 Garmin 请求。

## Validation Strategy

- Worker：室内骑行进入归档重解析候选，归一化指标保持 null/0 语义。
- Backend：Landing DTO 投影新增白名单 metrics，隐私字段仍不存在。
- Frontend：格式化/预设单测，组件交互语义测试（若现有测试栈不足则提取纯视图模型函数测试）。
- 视觉：运行本地 Landing，以 1440×900、1024×768、768×1024、390×844 检查卡片与弹窗，并保存截图或记录检查结果。
