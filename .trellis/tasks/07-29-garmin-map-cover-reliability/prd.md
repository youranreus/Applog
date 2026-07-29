# Garmin 地图封面可靠性与 Protomaps 底图

## Goal

让 Landing 的 Garmin 活动封面稳定呈现可辨识的地图语境：路线构图充满但不贴边，只有一个可靠位置时显示地图标记，足球以真实地图为底呈现 GPS 密度热力图；整个方案不产生地图订阅费用，也不把生产地图数据或私人活动地点写入 Git。

## Background and Evidence

- 对已归档的 4 条椭圆机活动做只读、脱敏核查后，activity list、summary、details、splits 都没有轨迹或地点字段；这类室内活动确实可能完全没有 GPS 轨迹。
- 其中 3/4 条椭圆机的 Garmin weather payload 含合法 `latitude` / `longitude`，可作为“天气/活动附近位置”标记，但不能称为 GPS 轨迹；剩余 1/4 没有任何可用点。4 条活动的公开 `locationName` 均为空。
- 当前部署的 CARTO 配置完整，允许联网时也能成功取图；最新跑步 WebP 实际含底图，但深色样式接近纯黑，视觉上像“没有地图”。
- 最新跑步路线亮色像素上下边距为 `0px`。根因是现有 `cover.py` 先按整数 zoom 渲染整图，再裁切、放大已经画好路线的图片，连路线笔画一起放大，无法稳定维持 padding。
- 当前 renderer 与 sync 都会吞掉异常并静默降级，无法区分配置、网络、HTTP、解码、viewport 或资源缺失错误。
- 供应商与缓存许可的官方资料评估记录在 `research/map-provider-evaluation.md`。用户不接受订阅费用，并最终选择先试用纯 Protomaps；腾讯、高德只保留为未来评估项。

## Requirements

### R1. Position evidence and privacy

- 将封面输入明确分为 `route`、`point`、`none` 三态。
- `route` 来自至少两个不同的合法 Garmin GPS 点；单个合法活动坐标降级为 `point`。
- `point` 的来源优先级为活动自身坐标，其次是 Garmin weather 坐标；worker 内保留 `activity` / `weather` provenance，公开 API、公共数据库投影和日志均不得出现原始经纬度。
- weather 点只能表达活动附近位置，不得称作 GPS 轨迹。
- 完全没有合法坐标时生成明确的无地图封面，不用站点默认城市或其他推断位置造点。

### R2. One deterministic viewport

- 路线、单点、足球热力采样与底图共享同一个 Web Mercator camera/viewport 计算结果。
- 480×480 最终图采用 32px 目标安全区并以 2× 渲染后下采样。路线最大跨度目标为 414–418px；像素测试容许 2px 抗锯齿误差。只有受路线长宽比影响的非主轴可以保留更多空白。
- overlay 必须在最终 camera 上以固定像素宽度绘制；禁止在画完路线后裁切并放大整张图。
- 处理非法坐标、重复点、极短路线、操场环线、极端长宽比和国际日期变更线；单点使用有上限的固定 zoom。

### R3. Pure Protomaps basemap

- MVP 只使用本地 Protomaps PMTiles，不调用 CARTO、腾讯、高德或其他在线地图 API，也不需要付费订阅。
- 首选固定版本 Martin，以仅监听 `127.0.0.1` 的独立服务提供静态 WebP；Python worker 只通过有超时的 localhost 接口取干净底图，再由 Pillow 统一合成 overlay。
- 实施先完成不接数据库的最小原型。若 Martin 未通过 camera 精度、中文字体、完全断网或稳定性门槛，则使用 TileServer GL 实现同一 localhost contract；不改变 R1、R2 或封面存储行为。
- 底图使用与 Landing 一致的浅色、低饱和样式，道路、街区和场地仍须可辨识。
- 本地 style、font、sprite 与 PMTiles 必须完整离线，运行时不得请求公网资源。

### R4. Coverage and data lifecycle

- 初始数据覆盖为“粤港澳大湾区高精度 + 全球 z0–6 低精度”。高精度包具体 bbox/maxzoom 写入 manifest，不从私人活动轨迹自动推导。
- 当活动所需 zoom 超过可用区域包能力时，生成明确的无地图状态并记录不含精确坐标的缺失区域标识，后续人工扩展 manifest；不得拉伸低精度数据冒充街区细节。
- 生产 PMTiles、活动封面和任何由私人活动区域推导的摘录不进入 Git。Git 仅保存样式、许可/NOTICE、版本/checksum manifest，以及与私人地点无关的极小公开 fixture。
- 地图发布包按月生成不可变 release；记录数据日期、bbox、maxzoom、schema/style 版本与 hash。原子切换并至少保留当前和上一个完整 release 以便回滚。
- 封面或 Landing 紧邻位置必须展示 `© OpenStreetMap contributors`，并保留 Protomaps/字体/图标所需 NOTICE。

### R5. Cover behavior

- 有轨迹的普通活动：浅色地图 + 高对比路线 + 起终点标记。
- 只有单点的活动：浅色地图 + 单个标记；内部 metadata 能区分 `activity` 与 `weather` provenance。
- 足球：浅色地图 + 由真实 GPS 采样密度生成的透明热力层，不再绘制纯球场插画；投影和底图严格对齐。
- 足球无有效 GPS 时不得伪造热力图，走 `point` 或 `none` 行为。
- renderer 不健康、资源缺失或区域不覆盖时，不得用低质量重试覆盖已有成功地图封面；首次生成且无法取得底图时可保存明确标识的本地降级封面。
- provider/style/data/renderer/overlay 版本共同决定封面 currentness；升级后只对最新公开候选做有界重生成。

### R6. Observability and operations

- 删除双层静默吞错。每次生成输出结构化结果，至少区分 `map_success`、`renderer_unhealthy`、`renderer_timeout`、`renderer_http_error`、`invalid_raster`、`asset_missing`、`region_missing`、`invalid_geometry` 与 `fallback_created`。
- 日志可包含活动内部 ID 的不可逆 hash、provider、release fingerprint、耗时和错误分类，但不能包含经纬度、bbox 明文、轨迹或私人 payload。
- Martin 锁定精确版本或镜像 digest，不使用 `latest`；升级 renderer 视为 render version 变化。
- Garmin systemd worker 启动前探测 renderer health；renderer 服务以低权限用户运行，地图 release 只读，只绑定 loopback。

## Acceptance Criteria

- [ ] AC1：测试覆盖 `route`、活动单点、weather 单点与完全无坐标四种输入；weather provenance 保持私有，公开 JSON/日志中无经纬度。
- [ ] AC2：短路线、操场环线、极端长宽比和跨日期线 fixture 的主轴可见跨度为 414–418px（抗锯齿误差另容许 2px），路线及起终点不越过 32px 安全区。
- [ ] AC3：健康的纯离线环境中，路线和单点封面均含浅色、可辨识 Protomaps 底图；测试会阻断外网并验证没有 font/sprite/style/tile 公网请求。
- [ ] AC4：足球封面在同一 camera 的 Protomaps 底图上显示真实 GPS 密度热力图，overlay 对齐误差不超过 2px；无有效 GPS 时不生成热力图。
- [ ] AC5：Martin 原型连续串行渲染 100 张混合 viewport，无空白图或持续 RSS 增长，并记录冷/热延迟、CPU/RSS、输出大小；若失败，TileServer GL 能以同一 contract 通过相同验收。
- [ ] AC6：renderer 故障与区域缺失产生可辨识错误分类；已有成功地图封面保持不变，新活动得到明确降级封面而非静默假装成功。
- [ ] AC7：两个实际地图 release 能完成前进、健康校验和回滚；失败发布不会提高 active render version，也不会触发旧封面降级覆盖。
- [ ] AC8：旧的 `carto-dark`、`local-route`、`local-heatmap` 封面能按有界批次重生成；最新六条在数据允许时分别得到路线地图、单点地图或地图热力图。
- [ ] AC9：生产数据包不在 Git；仓库中的 fixture 与 manifest 带来源、版本、bbox/maxzoom、hash 和许可说明，Landing 保留 OSM attribution。

## Out of Scope

- 接入腾讯、高德、Stadia、Mapbox 或其他云地图供应商。
- 为完全无坐标的活动推断或伪造位置。
- 在公开 API 返回 GPS、weather 坐标、bbox、轨迹采样或 provenance。
- 把生产 PMTiles、活动封面或私人区域摘录提交到 Git/Git LFS。
- 自动按私人活动地点下载新的区域包；首版只记录粗粒度缺失区域并人工扩展 manifest。
- 本任务不替代面向中国大陆公开发布地图所需的独立法律/测绘合规判断。

## Key Decisions

- 不接受订阅费用；MVP 为纯 Protomaps 本地渲染。
- Martin 是首选 renderer，TileServer GL 是原型失败时的接口兼容备选。
- 32px 是最终封面目标安全区，解决“贴边”和“中间只有一点点”的两端问题。
- weather 坐标可以生成单点地图，但只能在私有 worker 内标记 provenance。
- 初始覆盖为大湾区高精度 + 全球低精度；区域不足时明确无地图，不伪造细节。
- 地图数据按月不可变发布，至少保留两个 release；生产数据不进 Git。
