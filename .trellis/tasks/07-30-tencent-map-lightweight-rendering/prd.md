# 评估腾讯地图轻量合成方案

## Goal

在尽量保留 Garmin 活动封面地图质感、路线构图和可靠降级行为的前提下，评估用腾讯地图静态图 API 替代自托管 Protomaps/Martin 是否能显著降低部署与运维复杂度，并收敛出可验证的 MVP 边界。

## Background and Confirmed Facts

- 当前方案把 Martin、区域 PMTiles、样式、中文字体、manifest 和 NOTICE 打进独立 OCI 镜像；生产构建还需提取/合并地图数据、校验 release，并在部署时原子切换 renderer 与 manifest。
- Garmin worker 已有统一 camera、区域覆盖检查、renderer 超时/错误分类和 Pillow overlay 合成边界；供应商替换不需要推翻封面业务模型。
- 腾讯静态图 API V2 通过一个带 Key 的 HTTPS GET 返回栅格图，国内版支持 center/zoom 或 bounds、高清 scale、marker 和 path；图片足以覆盖当前 960×960 中间画布。
- 国内版 center 文档范围为纬度 3.5–53、经度 73.5–135；海外版是独立说明，且当前文档只声明 center、zoom、size，不声明 path/marker/bounds/scale。
- 腾讯方案把复杂度从自托管地图资产转移为公网依赖、Key/额度管理、供应商条款与坐标对齐验证；不能继续承诺完全离线和零第三方调用。

## Requirements

### R1. Evaluation target

- 对比现有自包含 Protomaps/Martin 方案与腾讯静态图方案的部署步骤、运行依赖、视觉能力、可靠性、隐私、安全、覆盖范围和持续成本。
- 以“单进程 worker + 一个腾讯 Key + 公网 HTTPS”作为轻量方案的理想部署上限，不引入新的地图 sidecar、地图数据卷或浏览器渲染器。

### R2. Visual and rendering compatibility

- 复用现有 camera 和本地 Pillow overlay；腾讯只提供干净底图，路线、起终点、单点和足球热力层仍由 AppLog 绘制，以保持像素控制和供应商可替换性。
- 腾讯请求仅携带转换后的中心点、整数 zoom、`size=480*480`、`scale=2` 与 `maptype=roadmap`，不得携带 path、marker、活动 ID 或完整轨迹。
- 验证腾讯底图与 Garmin WGS-84 轨迹经合规坐标转换后的对齐误差、中文标注质量、道路/场地辨识度和 2× 输出清晰度。
- 不使用腾讯 `path` 合成路线，避免降低样式控制或把完整轨迹放进请求 URL。

### R3. Operational compatibility

- Key 只能存在于 worker 服务端配置，不进入前端、日志、生成图片元数据或 Git。
- 保留超时、HTTP/解码错误分类、已有成功封面不被降级覆盖、首次失败生成明确 fallback 的现有可靠性语义。
- 明确额度耗尽、腾讯服务不可用、境外活动、坐标不支持时的可观察行为。
- MVP 只保证中国大陆范围内的活动使用腾讯底图；境外活动不接第二 provider，直接走明确的无地图降级封面。

### R4. Decision evidence

- 用固定公开地点与合成路线做最小原型，不向腾讯发送真实私人活动轨迹。
- 原型至少对照当前 Protomaps 输出与腾讯 roadmap 输出，并记录请求延迟、输出尺寸、构图、对齐和失败响应。

## Acceptance Criteria

- [x] AC1：不部署 Martin、PMTiles、地图数据卷或地图镜像时，worker 能通过腾讯生成并验证 960×960 roadmap 底图，再由现有合成链路产出封面。
- [x] AC2：腾讯请求只包含转换后中心点、zoom、尺寸、maptype 和服务端 Key；测试证明不包含 path、marker、活动 ID 或完整轨迹。
- [x] AC3：公开控制点与合成路线在 zoom 12、15、17 的本地 overlay 对齐误差不超过最终图 2px，路线使用约 6px 红色粗线与首尾方向箭头，并保持 16px 目标安全区。
- [x] AC4：同一 camera 和 overlay 的 A/B 样图中，腾讯 roadmap 的道路/场地辨识度、中文标注和路线对比度达到“至少不差于当前 Protomaps”的人工验收结论。
- [x] AC5：专用 Key 只启用 WebService 并保存在 worker secret 中；日志、指标、公开 API、图片元数据和 Git 均不出现 Key、完整请求 URL或坐标。
- [x] AC6：超时、HTTP 错误、额度耗尽、非法栅格与区域不支持均产生可区分结果；已有成功封面不会被失败结果覆盖，首次失败保留明确 fallback。
- [x] AC7：中国大陆支持范围外的活动不会调用备用地图供应商，也不会用错误区域底图冒充成功；系统返回可观察的 `region_missing`。
- [x] AC8：实际上线前已核对当前账户的静态图额度、商用资格、Key 限制及图片持久化/展示条款；任一不满足则停止切换默认 provider。

## Out of Scope

- 本规划阶段不修改生产 renderer，不申请或写入真实腾讯 Key，不上传私人 Garmin 轨迹。
- 不建设通用多供应商地图平台或前端交互地图。
- 不在没有授权和条款依据时长期缓存、再分发腾讯底图。

## Key Decisions

- MVP 地域范围限定为中国大陆；境外活动生成明确降级封面，不为全球覆盖保留第二 provider 或自托管 renderer。
- 腾讯只提供干净的 roadmap 底图；最终路线、起终点、单点和足球热力层全部由 AppLog 本地绘制。
- 腾讯请求不发送完整活动轨迹；第三方只会收到生成底图所必需的转换后中心点、zoom、尺寸与 Key。
- 路线 overlay 使用约 6px 红色粗线，起点和终点按首段/末段方向显示箭头；目标安全边距最终收紧为 16px。
