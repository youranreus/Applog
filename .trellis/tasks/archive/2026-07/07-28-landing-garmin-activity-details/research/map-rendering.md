# Garmin 地图封面渲染方案

## Constraints

- Garmin sync worker 是 Python 3.12，当前 FC 配置为 0.5 CPU、512MB 内存、512MB 临时磁盘、300 秒超时。
- 前端目前没有 MapLibre/Leaflet，后端没有对象存储或动态静态文件目录。
- 用户已选择同步时服务端生成静态 WebP，浏览器不接触坐标或地图瓦片。
- 地图只用于最近公开活动的封面；私有完整轨迹长期入库不意味着为所有历史活动预生成图片。

## Renderer Comparison

| 方案 | License / runtime | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| `staticmap==0.5.7` | Apache-2.0；Pillow + requests | 依赖少；路线、marker、padding、PNG 直接可用 | attribution 和 tile cache 需自行补齐 | 可用 |
| `py-staticmaps==0.5.0` | MIT；Pillow + requests + 纯 Python 地理依赖 | 自动 fit、路线/marker、可见 attribution、磁盘 tile cache；无需 Cairo 也可 PNG | 依赖略多；Pillow 路线抗锯齿需 2x 渲染后缩小 | **采用** |
| MapLibre GL JS / native | BSD；需要浏览器或 native runtime | 矢量样式能力最强 | Python FC 集成重，512MB/部署复杂；违背静态轻量目标 | 不采用 |
| 自托管 OpenMapTiles | 开源数据/renderer | 完全控制样式、隐私和 SLA | 需要额外 tile pipeline/存储/服务，超出个人 Landing 本期 | 延后 |

## Selected Design

- 使用 `py-staticmaps` 的 Pillow renderer；不引入 Cairo 系统依赖。
- 以目标尺寸 2 倍渲染，再用 Pillow LANCZOS 缩小并编码 WebP，改善路线抗锯齿。
- 路线按 bbox 自动 fit，并保留显著安全边距；起点/终点标记保持克制。
- 深色底图、路线颜色、署名、renderer 版本与尺寸进入 `renderVersion`；版本变化可选择性重建。
- 图片存独立媒体表，记录 `contentType`、尺寸、字节数、hash、attribution、provider 与生成时间。

## Tile Provider Boundary

`py-staticmaps` 是开源 renderer，但底图服务仍有独立使用条款。

OpenStreetMap 官方标准 tile server 明确：

- 必须显示 attribution、使用可识别 User-Agent、遵守缓存头；
- 禁止后台批量预取和 offline use；
- 没有 SLA，可随时阻断不合规流量。

因此：

- **不得**把 `tile.openstreetmap.org` 作为历史后台批量生成的默认来源。
- tile URL、attribution、User-Agent 和 provider 名称必须配置化。
- 生产部署必须使用明确允许服务端静态图生成/缓存的 provider，或未来自托管。
- worker 只为当前公开候选（最近 6 条及新进入候选的活动）生成封面；不会为全部历史预取瓦片。
- provider 不可用时保留旧 WebP；首次生成失败则回退到无底图的深色路线封面，不影响活动/健康数据同步成功。

候选默认视觉可采用 CARTO 开源 `Dark Matter` 样式；其托管 tile 的实际生产使用仍受 CARTO 服务条款约束，故以配置和部署时验证为准，不能把样式仓库的开源许可证误当成 CDN 使用授权。

## Serving and Cache

- 数据库媒体记录使用随机公开 key，不暴露 Garmin source id。
- 后端提供原始图片响应端点（不经过 JSON transform），设置：
  - `Content-Type: image/webp`
  - immutable/长缓存头
  - `ETag` 基于内容 hash
- `IGarminLandingActivity.cover` 只包含 URL、宽高、alt/attribution 所需的安全信息。
- WebP 不写 EXIF、GPS 或上游 metadata。

## Failure and Rollback

- 图片生成与活动详情持久化分开提交；provider/renderer 失败不得回滚数据同步。
- 保留最后成功图片，只有新图片完整生成并 hash 校验后才原子替换。
- 可通过关闭 map cover 开关回退到当前抽象 SVG/室内占位，不影响公开活动列表。

## Primary Sources

- `py-staticmaps` PyPI/GitHub：0.5.0，MIT，Pillow renderer、tile cache 与 attribution。
- `staticmap` PyPI/GitHub：0.5.7，Apache-2.0，Pillow + requests。
- OpenStreetMap Foundation Tile Usage Policy：标准 tile server 要求 attribution、明确 User-Agent、缓存，并禁止后台批量/offline 预取。
- CARTO basemap styles：Dark Matter raster/vector style 开源；托管服务条款需单独遵守。
