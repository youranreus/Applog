# 腾讯静态图方案初评

## Repository evidence

当前自托管方案的部署重量主要来自地图资产生命周期，而不是封面合成本身：需要构建含 Martin、PMTiles、样式和字体的 OCI 镜像，生产构建执行远程 Range extract、merge、verify，部署时还要从同一 digest 导出 manifest，并协调 worker timer、容器健康和原子切换。

现有 `LocalMapRenderer` 的输入已经是统一 `MapCamera`，输出是 2× WebP/Pillow image；overlay 在本地绘制。因此腾讯替换可以被限制为一个新的底图适配器，保持上层 `route` / `point` / `none`、足球热力、currentness 和降级语义不变。

## Official API evidence checked on 2026-07-30

- 腾讯静态图 API V2 是带 Key 的 HTTPS URL 接口，支持地图位置、缩放、标注和路线。
- 返回尺寸宽 50–1680、高 50–1200；`scale=2` 时建议 `size` 最大 900×900。AppLog 可请求 `480×480&scale=2` 得到 960×960 中间图。
- 国内版支持 roadmap、satellite、hybrid；zoom 为 4–18，scale=2 支持到 17。
- 国内版支持 `bounds` 自动取景，也支持 `path`；单条 path 最多 800 坐标，并提供压缩坐标串机制。
- 国内版 center 明示范围是纬度 3.5–53、经度 73.5–135，不能据此承诺全球覆盖。
- 腾讯提供单独的海外静态图说明，但当前参数只列 Key、center、zoom、size，并注明不支持韩国；未声明国内版的 path、marker、bounds、scale。
- 官方说明允许对相同请求缓存结果并定时更新来降低调用量，但具体缓存期限、图片再分发授权和当前账户额度仍需在控制台/服务条款中确认。

## Preliminary recommendation

推荐进入一个“腾讯仅供底图、本地继续画 overlay”的小型 spike，而不是让腾讯直接合成最终路线图：

1. 部署最轻：移除地图容器、PMTiles release、字体与 manifest 运维，只增加 Key 和一个 HTTPS client。
2. 效果可控：保留现有 camera 和 Pillow 路线/热力层，避免被静态 API 的 path 样式和 URL 长度绑死。
3. 隐私更好一些：底图请求只需 center/zoom，不必把整条私人轨迹传给腾讯；但中心点本身仍是位置数据，必须明确接受该第三方处理边界。
4. 替换成本低：继续保留 renderer protocol，让未来换高德或回退自托管不影响封面业务层。

用户已确认 MVP 只保证中国大陆活动，并选择腾讯只返回底图、AppLog 本地绘制 overlay。境外活动不引入第二 provider。

## Main risks to validate

- Garmin GPS 通常为 WGS-84，而中国互联网地图展示涉及偏移坐标；必须用公开控制点验证转换方向和像素级 overlay 对齐，不能只看“差不多”。
- 腾讯默认 roadmap 视觉样式基本不可定制，最终质感是否优于当前浅色 Protomaps 只能通过同 camera A/B 图判断。
- 公网/API/额度成为新的单点故障；已生成封面应复用，不应每次页面访问实时请求腾讯。
- 海外活动能力明显弱于国内版；若产品要求全球一致体验，腾讯单 provider 不足以完成替换。
- Key、日额度、QPS、商业使用资格、缓存与图片展示条款需要用实际账户控制台和最新协议确认，公开文档页没有给出足够的固定数字。
- WebService 响应头提供 `X-LIMIT`，包含当前/上限 QPS 与当日/上限调用量；实现可以采集这些值做额度预警，但不得把 Key 或带 Key 的完整 URL写入日志。

## Sources

- https://lbs.qq.com/service/staticV2/staticGuide/staticOverview
- https://lbs.qq.com/service/staticV2/staticGuide/staticDoc
- https://lbs.qq.com/service/webService/webServiceGuide/Overseas/staticDoc
