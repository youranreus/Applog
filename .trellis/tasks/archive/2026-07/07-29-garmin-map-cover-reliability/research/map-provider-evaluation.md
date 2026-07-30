# Garmin 封面地图供应商评估

> 调研日期：2026-07-29。只采用供应商、OpenStreetMap Foundation 与 Protomaps 的官方资料。价格与条款会变化，上线前仍应复核；本文不是法律意见。

## 结论

对 AppLog 的实际用法——worker 在服务端生成 480×480 封面、保存结果、再提供给 Landing，并在底图上本地叠加路线、单点标记或足球热力图——推荐：

1. **主供应商：Stadia Maps `static_cacheable`（Starter 起）**。它是本次候选中唯一在标准公开条款里明确允许把静态图保存到自有基础设施、修改、嵌入并数字再分发的云服务；许可随付费订阅存续。静态 API 支持 marker、line、自动 viewport，底图返回后可在本地叠加热力图。[Static Maps 文档](https://docs.stadiamaps.com/static-maps/)，[Cacheable Static Maps Addendum](https://stadiamaps.com/terms-of-service/)
2. **离线备份：Protomaps Basemap 区域 PMTiles + 本地渲染**。Protomaps 官方提供每日 OSM 派生 PMTiles、支持 bbox/maxzoom 提取，并明确以 ODbL Produced Work 分发；区域包可以合法持久保存、自托管，满足远程服务不可用时仍有底图。[下载与许可](https://docs.protomaps.com/basemaps/downloads)，[区域提取](https://docs.protomaps.com/guide/getting-started)
3. **不要把第三方云瓦片批量提交进 Git**。Mapbox、MapTiler、HERE、CARTO 云底图均没有适合本项目的公开持久缓存/仓库再分发授权；OSMF 的公共 tile.openstreetmap.org 也明确禁止预抓取和离线瓦片包。[OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)

若不接受每月 $20 的 Stadia 订阅，次优方案不是换另一个免费瓦片域名，而是直接把 Protomaps 本地渲染升为主路径；代价是维护渲染器、字体/精灵、区域数据更新与存储。

## 需求与许可判断方法

这里必须区分三种资产：

- **OSM 源数据库/区域摘录**：ODbL 开放数据，可以复制、修改和分发，但必须署名；发布修改后的数据库时有同许可义务。[OSM Copyright and License](https://www.openstreetmap.org/copyright)
- **由 OSM 数据自行生成的 PMTiles/地图图像**：仍需 OSM attribution，但不是 OSMF 公共瓦片服务本身。Protomaps 明确将其 basemap PMTiles 作为 ODbL Produced Work 分发。[Protomaps downloads](https://docs.protomaps.com/basemaps/downloads)
- **第三方已经渲染好的瓦片/静态图片**：受第三方商业条款约束；“底层数据来自 OSM”不意味着可以复制 Mapbox、MapTiler、CARTO 或 Stadia 的渲染结果。

“HTTP 缓存”也不等于“可提交 Git”：前者通常受 TTL、设备范围、订阅存续限制；后者是持久复制并可能向所有 clone/fork 再分发，必须有明确许可。

## 供应商对照

| 方案 | API 与封面适配 | 2026-07-29 公开价格/限额 | 缓存、离线与 Git | 中国大陆与可靠性 | 结论 |
|---|---|---|---|---|---|
| **Stadia Maps** | Raster/vector tiles；Static Maps 支持 marker、line、自动 fit；`static_cacheable` 支持 GET/POST，适合服务端生成后本地叠加热力图 | Free：200k credits/月、非商业；Starter：$20/月、1m credits、超额 $0.03/1k；普通 static 20 credits/图，cacheable static 2,000 credits/图，因此 Starter 约含 500 张 cacheable 图/月（未计其他调用）。[Pricing](https://stadiamaps.com/pricing) | 普通 tile/静态图仅客户端 HTTP 缓存；一般禁止代理/批量缓存。`static_cacheable` 明确允许保存、修改、嵌入与数字再分发，只要维持付费订阅。[Terms §30.3](https://stadiamaps.com/terms-of-service/) **运行时/对象存储：是；Git：私库技术上可落入自有基础设施，但不推荐，公开仓库或订阅终止后的权利不够稳，应先取得书面确认。** | 官方资料未承诺中国大陆节点、可达性或合规地图版本；必须从实际部署网络做探测。Starter 未见公开 SLA，企业可谈定制 SLA。[Limits](https://docs.stadiamaps.com/limits/) | **最匹配主供应商**；许可清楚，但要续订与做中国网络实测 |
| **Mapbox** | Static Images API 支持 bbox/padding、marker/path/GeoJSON；480×480 足够；默认 1,250 req/min | Static Images 每月前 50k 免费，之后 $1.00/1k（50k–500k），更高阶梯更低。[Pricing](https://www.mapbox.com/pricing)，[API limits](https://docs.mapbox.com/api/maps/static-images/) | 官方 Static Maps 页面写明：请求应由终端设备生成；服务端生成的结果不可再分发给终端；只可在客户端缓存至多 30 天，长期缓存需联系销售。[Static Maps limitations](https://www.mapbox.com/static-maps) **运行时持久缓存：否；Git：否，除非定制合同。** | 官方公开文档未给出当前中国大陆 API 可达性承诺或大陆合规版。全球 API/数据不等同于大陆稳定可用；需网络和法务验证。 | API 很好、价格低，但**默认许可不匹配当前 worker 架构** |
| **MapTiler Cloud** | Paid plan 提供 Static Maps，支持 markers、lines、auto extent；也有 raster/vector tiles | Free：$0、100k API req/月但仅测试/个人/非商业且无 Static Maps；Flex：$30/月、500k API req/月，超额 $0.15/1k；每张 static 计 15 requests。[Pricing](https://www.maptiler.com/cloud/pricing/)，[Static API](https://docs.maptiler.com/cloud/api/static-maps/) | Cloud 条款只允许单一终端用户的临时个人缓存；代理、导出服务外内容和批量下载都需书面定制协议。[Cloud Terms](https://www.maptiler.com/terms/cloud/) **服务端持久缓存：否；Git：否。** 如购买 MapTiler Server/数据则是另一份 on-prem 许可，不应与 Cloud 权利混同。 | 官方称 300+ edge、亚洲数据中心可使标准地图在亚洲提速最多 80%，但未承诺中国大陆节点/可达性或监管批准。[Infrastructure](https://www.maptiler.com/cloud/infrastructure/) | 技术适配，Cloud 许可不适配；只有谈 custom/on-prem 才值得考虑 |
| **HERE** | Map Image API v3 可生成自定义尺寸静态图，并以 GeoJSON/overlay 加 marker、line；Map Image 2 RPS（Limited） | Limited：每天 1,000 requests；Map Image 2 RPS。Base 为 pay-as-you-grow，但当前公开价格页未展示 Map Image v3 单价，需控制台/销售确认。[Limited restrictions](https://www.here.com/get-started/pricing/limited-plan-restrictions)，[Map Image quickstart](https://docs.here.com/map-rendering/docs/quickstart-map-image-api) | 开发者条款禁止为了建立位置资产库或一请求服务多用户而预取/缓存；仅响应头允许或最多 30 天、且为改善单一终端用户使用时例外。[Developer Terms](https://developers.here.com/terms-and-conditions) Raster Tile 最佳实践建议 24h，并重申不能建 repository。[Caching](https://docs.here.com/map-rendering/docs/cache-maps-raster-tile-api) **Git：否。** | HERE 官方监管通知明确：平台默认在中国的 Entry Map 是在中国境外分发的，**未获准在中国大陆分发**；大陆合规详细图需按 case 购买 NavInfo 授权。[Regulatory notice](https://docs-be.here.com/bundle/local-maps-regulatory-approval-policies-5.7/raw/resource/enus/Local_Maps_Regulatory_Approval_OLP_v5.7_Customer_Notice.pdf) Map rendering 有 99.9% 服务可用性目标，但不解决许可与大陆版本问题。[SLA coverage](https://docs.here.com/policies/docs/service-availability) | 全球企业级能力强，但缓存和中国大陆许可均不适合作为默认方案 |
| **CARTO Basemaps** | OSM 派生 vector tiles，MapLibre 兼容；官方当前产品重心是 Builder/deck.gl/空间分析，没有面向此类 worker 的独立 Static Image API | 商用 CARTO Basemaps 需要 Enterprise 许可；价格 quote。平台有 14 天评估 trial，生产不可用。[Basemap FAQ](https://docs.carto.com/faqs/carto-basemaps)，[Pricing](https://carto.com/pricing/) | 官方允许下载/修改 style JSON，但这不是对底图 tiles 的下载授权。[Style docs](https://docs.carto.com/carto-for-developers/key-concepts/carto-for-deck.gl/basemaps/carto-basemap) 未找到允许将 basemap tiles/渲染图持久缓存或放入 Git 的公开条款，故**一律视为否，除非合同明确授权**。 | 未找到官方中国大陆 CDN、可达性或合规承诺；需要测试/销售确认。 | 对 AppLog 过重、无静态图优势、商业许可不透明，不推荐 |
| **OSM + Protomaps/PMTiles（自托管）** | Protomaps 提供单文件 vector basemap；可按 bbox/region/maxzoom 提取，本地 MapLibre/headless renderer 生成静态图，再精确叠加路线/点/热力图 | 数据下载免费；完整 planet z0–15 约 120 GB；仅 z0–6 约 60 MB。成本是自己的存储、构建、更新与渲染资源。[Downloads](https://docs.protomaps.com/basemaps/downloads)，[Getting started](https://docs.protomaps.com/guide/getting-started) | Protomaps 明确允许下载后复制到自有 cloud storage。区域 PMTiles 可长期保存、自托管，**可提交 Git（满足 ODbL attribution/再分发条件）**；但应限制体积并记录来源版本/hash。严禁把 tile.openstreetmap.org 批量抓成包，OSMF 公共 tiles 无 SLA 且禁止 prefetch/offline。[OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/) | 不依赖境外 tile 域名，网络最可靠。数据覆盖取决于 OSM；在中国大陆公开发布地图还涉及测绘、坐标与地图审图监管，OSM/Protomaps 许可本身不等于大陆发布批准，需另行法务判断。 | **最佳离线备份；也可作为零订阅主路径** |

## Attribution 要求

- **Stadia**：应保留响应中的 attribution；手动放置时按样式列出 Stadia Maps、OpenStreetMap，若使用 Stamen 样式再列 Stamen，并提供相应 URL。[Stadia attribution guide](https://docs.stadiamaps.com/attribution/)
- **Mapbox**：Static Images 默认带 attribution 与 logo；即使 `attribution=false`，使用 OSM 数据的地图仍须在页面或文档其他位置署名。[Static Images API](https://docs.mapbox.com/api/maps/static-images/)
- **MapTiler**：每张地图需要 `© MapTiler © OpenStreetMap contributors`；免费账户还需 MapTiler logo；静态图可在图内或紧邻图片显示文字。[Attribution guide](https://docs.maptiler.com/guides/map-design/attribution/add-attribution/)
- **HERE**：保留 Map Image 默认 copyright notice；具体供应商 attribution 以 API 返回为准。API 允许控制 copyright 参数，但删除显示不代表免除合同义务。[Map Image reference](https://docs.here.com/map-rendering/reference/getimage)
- **CARTO**：官方界面保留 basemap attribution；CARTO basemap 底层为 OSM。[CARTO basemap FAQ](https://docs.carto.com/faqs/carto-basemaps)
- **Protomaps/OSM**：封面或 Landing 紧邻位置显示 `© OpenStreetMap contributors` 并链接 OSM copyright/ODbL；若直接分发 PMTiles 数据包，还要随包说明数据库许可。OSM 要求 attribution 且明确数据采用 ODbL。[OSM copyright](https://www.openstreetmap.org/copyright)

480×480 封面上的 attribution 不能因为视觉简洁而直接裁掉。可选做法是保留图内极小但可读 attribution，或在 Landing 卡片/详情页紧邻封面展示；最终应逐一符合选定供应商条款。

## Git 仓库存储边界

### 可以提交

- 自有样式 JSON、颜色配置、marker 图标、渲染代码与测试 fixture。
- 许可证兼容的开源字体/精灵，并保留各自 LICENSE。
- Protomaps 官方 PMTiles 的**小型、公开区域、固定版本摘录**，前提是：
  - 文件旁保存来源 URL、build date/version、BLAKE3/hash、bbox、maxzoom 与 attribution；
  - 仓库 LICENSE/NOTICE 说明其是 OSM 派生数据及 ODbL；
  - 若在摘录上形成并公开衍生数据库，按 ODbL 提供相应数据库；
  - 不由私人 Garmin 轨迹自动计算 bbox 后提交，避免把常驻地/运动地点固化进 Git 历史。

### 不应提交

- Mapbox、MapTiler Cloud、HERE 或 CARTO 下载的 raster/vector tiles、静态图缓存。
- OSMF `tile.openstreetmap.org` / `vector.openstreetmap.org` 的抓取结果或离线包。
- Stadia 普通 tiles/static 缓存。
- 即使使用 Stadia `static_cacheable`，也不建议把活动封面提交 Git：条款允许数字存储/再分发的前提是持续付费，Git 历史难以在退订后清理，而且封面隐含个人活动地点。应存对象存储/媒体卷；若确需放公开 Git，先取得 Stadia 书面确认。

### 体积建议

- Git 普通对象只放样式、sprite、glyph 子集和极小 PMTiles fixture。
- 生产区域包优先放 release artifact、对象存储或部署镜像层，并用 checksum/version manifest 固定版本。
- Protomaps 官方给出的 z0–6 全球包约 60 MB，虽可用 Git LFS，但每次更新仍增加仓库与 CI 拉取成本；生产建议作为可重复下载的构建依赖或 release asset，不直接进入主 Git 历史。

## 推荐架构

```text
Garmin 坐标（仅 worker 内）
        │
        ├─ route / point / heat samples
        │
        ▼
统一 viewport 计算器 ── 固定 480×480、安全边距、Web Mercator
        │
        ├─ 1. Stadia static_cacheable：只请求干净底图
        │      └─ 成功图按 provider/style/z/x-y-or-bbox/version 存对象存储
        │
        └─ 2. 超时/429/5xx/无凭据 → 本地 Protomaps PMTiles 渲染
               └─ 区域包缺失 → 明确 no-basemap 状态与可观测错误
        │
        ▼
本地统一合成：路线 / 单点 marker / 足球 heatmap / attribution
        │
        ▼
最终封面媒体存储（不把原始经纬度暴露到 API 或 Git）
```

关键设计理由：

- 供应商只负责底图；路线、单点与足球热力图始终由同一个本地投影/viewport 模块合成，避免不同 API 的 auto-fit、整数 zoom 或 padding 语义造成贴边和热力图错位。
- 请求 Stadia 时使用 `static_cacheable` 而不是普通 static/tiles，缓存 key 带 provider、style、viewport、像素密度与数据版本；**不包含 activity id 或原始坐标明文日志**。
- 本地 PMTiles 不是抓取在线瓦片，而是许可明确的 Protomaps build/extract；固定版本可重复渲染，远程服务异常时不会退化成无地图纯色图。
- 外部调用设置短连接/总超时、有限重试和熔断；分别记录 `provider_success`、`provider_timeout`、`provider_429`、`offline_success`、`offline_region_missing`，让“没有地图”成为可诊断状态。

## 中国大陆专项判断

1. **不要从“全球覆盖”推断“大陆可稳定访问”**。Mapbox、Stadia、MapTiler、CARTO 的官方公开资料均未给出可供本项目依赖的大陆可达性或大陆合规地图承诺；应在实际 worker 部署网络上定期 probe，而不是只在开发机测试。
2. **HERE 给出了明确负面边界**：默认平台中国 Entry Map 是在境外分发且未获准在大陆分发；若要在大陆发布，需单独购买 NavInfo 详细地图授权。[HERE regulatory notice](https://docs-be.here.com/bundle/local-maps-regulatory-approval-policies-5.7/raw/resource/enus/Local_Maps_Regulatory_Approval_OLP_v5.7_Customer_Notice.pdf)
3. **自托管解决网络问题，不自动解决地图监管问题**。Protomaps/OSM 能让 worker 不依赖跨境 API，但面向中国大陆公众展示地图可能涉及测绘资质、坐标体系和地图审核。若 AppLog 仅私人使用，风险形态不同；若公开上线，应由熟悉中国地图法规的律师确认。
4. 实施前做同一组坐标的视觉对齐测试：Garmin GPS 通常是 WGS84；大陆商业地图可能采用经偏移/受监管的数据体系。路线、marker、heatmap 与底图必须用同一投影与坐标转换，否则会整体偏移。

## 采购与上线前核对项

- 向 Stadia 书面确认 AppLog 的具体模式：后端 worker 生成、保存活动封面、Landing 再分发；确认订阅终止后旧封面的处置期限。
- 若需要公开 Git 存任何 Stadia 生成图，单独取得书面许可；默认设计不这样做。
- 在生产出口连续测试 `tiles.stadiamaps.com`：DNS/TLS、p50/p95、429/5xx、超时与大陆可达性。
- 选择 Protomaps 区域包清单与更新频率；每个包记录 build、bbox、maxzoom、hash、license/NOTICE。
- 明确 attribution 在 480×480 封面及 Landing 上的最终位置，并做像素级测试，防止裁剪。
- 设置封面重生成策略：provider/style/data/render-version 任一变化才重算；远程失败时先用离线底图，不覆盖已有成功地图封面。

## 最终排序

1. **Stadia `static_cacheable` + Protomaps 离线备份**：许可最贴合、实现成本最低、可可靠降级。
2. **纯 Protomaps 自托管**：最可控、无订阅依赖；运维与更新成本较高。
3. **MapTiler Custom/Server**：若愿意采购 on-prem 合同，可作为商业自托管替代；Cloud 默认条款不行。
4. **Mapbox 定制合同**：API 与价格优秀，但公开标准许可不允许当前后端生成再分发模式。
5. **HERE 定制合同**：只有在同时解决持久缓存和中国 NavInfo 授权时考虑。
6. **CARTO**：为静态活动封面过重，缺少独立静态图与明确缓存优势。

## 国内供应商补充：腾讯位置服务与高德开放平台

> 补充日期：2026-07-29。下列判断只依据两家供应商当前公开的产品文档、协议和价格页；控制台内额度及商务合同可能不同。公开条款未明确授权的持久保存、修改或再分发能力，一律不假设存在。

### 快速对照

| 项目 | 腾讯位置服务 Static V2 | 高德静态地图 Web Service |
|---|---|---|
| **静态图能力** | `GET https://apis.map.qq.com/ws/staticmap/v2/`；支持 center/zoom 或 bounds、roadmap/satellite/hybrid、marker（最多 50）、label（最多 30）、path（最多 256，每条最多 800 点）和自动视野；图片最大 1680×1200，支持 2×。[Static V2 文档](https://lbs.qq.com/service/staticV2/staticGuide/staticDoc) | `GET https://restapi.amap.com/v3/staticmap`；支持 center/zoom、marker（最多 10）、label（最多 10）、path/polygon（合计最多 4）和覆盖物自动视野；逻辑尺寸最大 1024×1024，支持 `scale=2`。[静态地图文档](https://lbs.amap.com/api/webservice/guide/api/staticmaps) |
| **服务端生成** | 是 REST URL，Key 必填，适合 worker 请求。每个 Key 有日调用上限；企业认证可提升，但公开文档没有展示可独立核验的 2026 数字或统一单价，应以登录控制台/商务报价为准。[Static V2 概览](https://lbs.qq.com/service/staticV2/staticGuide/staticOverview) | 是 Web Service REST API，Key 必填，可选数字签名 `sig`。2025-05-20 起基础 LBS（静态地图与地理编码等共享额度）为 ¥30/万次；个人认证 15 万次/月、企业认证 300 万次/月、企业技术服务许可 900 万次/月。商业使用还需购买技术服务许可，基础版 ¥5 万/年、高级版 ¥10 万/年。[配额与计费](https://lbs.amap.com/upgrade)，[商业授权说明](https://lbs.amap.com/faq/advisory/authorization/43168) |
| **缓存/持久存储** | 官方静态图概览明确建议对相同重复请求缓存结果并定期刷新，这是本次国内候选里最积极的公开缓存说明。但它描述的是运行缓存，不等于永久归档；开放 API 协议只授予在自有网站/App 内调用和展示的不可转让、不可分许可，且限制协议外复制、修改、发布、镜像或衍生使用。[Static V2 概览](https://lbs.qq.com/service/staticV2/staticGuide/staticOverview)，[开放 API 协议 §2、§6](https://lbs.qq.com/terms.html) | 默认不允许。服务协议 §3.5 与 §7.3 明确限制直接存储、缓存、下载、镜像、复制、截图、修改、改编、传播和发布服务数据/图片，除非有书面许可。[高德开放平台服务协议 §3.5、§7.3](https://lbs.amap.com/pages/terms/) |
| **Landing 展示与本地叠加** | 在 AppLog 自有 Landing 中展示正常 API 响应属于协议描述的基本场景；但将底图长期存入对象存储、在图上本地合成足球热力层后再提供给访客，并没有清晰的公开授权。应取得腾讯对“后端生成 + 定期刷新缓存 + 本地合成自有 overlay + 公共页面展示”的书面确认。 | API 原生可画 marker/path，但当前“worker 下载底图、长期保存、再本地合成热力图”的流程同时触及存储与修改限制。只有商务合同明确授权后才能采用；普通 Key 或技术服务许可价格本身不能推定这些权利。 |
| **署名、Logo 与审图信息** | 不得删除、修改、遮挡或替换腾讯位置服务及合作方在地图图片/结果中的商号、商标、服务标识或 Logo。[开放 API 协议 §6.2(14)](https://lbs.qq.com/terms.html) | 不得删除、遮挡、修改或替换地图中的审图号、出版/许可信息、高德及合作方版权和 Logo。[服务协议 §7.7](https://lbs.amap.com/pages/terms/) |
| **Key 限制** | Key 必填、额度按 Key 计算；WebService API 权限及限制在控制台配置。公开静态图页没有足够信息确认通用 Key 是否同时支持出口 IP 与域名白名单，部署前应在实际账号控制台核验，服务端 Key 不得进入前端或 Git。 | Web Service Key 可绑定服务器出口 IP 白名单，官方强烈建议启用；IP 不匹配、域名不匹配、签名错误或平台类型错误都会拒绝请求。[IP 白名单说明](https://lbs.amap.com/faq/webservice/webservice-api/basic-configuration/43234)，[错误码说明](https://lbs.amap.com/api/webservice/guide/tools/info/) |
| **中国大陆适配** | 国内底图服务，Static V2 明确区分境内与海外版本；境内接口限定中国范围并使用受监管坐标体系，网络和监管适配显著强于未承诺大陆服务的海外候选。[Static V2 文档](https://lbs.qq.com/service/staticV2/staticGuide/staticDoc) | 国内底图服务，商业授权、审图号和 Logo 义务在官方条款中明确；公开价格页还给出技术服务版 99.95%、高级版 99.99% 可用性目标。[配额与计费](https://lbs.amap.com/upgrade) |

### Garmin 坐标必须先统一为 GCJ-02

Garmin 记录的 GPS 经纬度通常按 WGS84 理解；腾讯和高德在中国大陆底图上使用 GCJ-02。腾讯位置服务发布的坐标系 FAQ 明确说明其 API 使用 GCJ-02，并要求 GPS 坐标先转换；高德官方文档同样说明 WGS84 是常见 GPS 设备坐标，而高德坐标为 GCJ-02，并提供 `coordsys=gps` 的坐标转换服务。[腾讯位置服务坐标系 FAQ（腾讯官方账号发布）](https://cloud.tencent.com/developer/article/1361312)，[高德坐标转换 Web Service](https://lbs.amap.com/api/webservice/guide/api/convert)，[高德坐标系说明](https://lbs.amap.com/api/javascript-api-v2/guide/transform/convertfrom)

这不是可忽略的视觉误差。路线、单点 marker、足球热力采样点及用于求 viewport 的全部坐标，必须先以同一转换结果进入渲染流程；若只转换路线、不转换热力点或 bbox，覆盖层会整体偏离底图，自动 fit 也会错误。建议把转换后的 GCJ-02 点列作为一次渲染内的中间值，不覆盖原始 Garmin/WGS84 数据，并把 `coordinate_system` 和转换版本写入缓存 key。

### 国内供应商的存储与发布边界

| 去向 | 腾讯公开条款下的判断 | 高德公开条款下的判断 |
|---|---|---|
| worker 内短期缓存、定期刷新 | **可行性较高**：静态图文档明确建议缓存重复结果并定期刷新；仍需遵守 Key、额度与标识要求 | **不可默认采用**：通用条款明确限制直接缓存，需书面许可 |
| 私有对象存储中的长期活动封面 | **需书面确认**：公开文档没有给出保留期限、订阅终止或长期归档权 | **需书面许可**：默认条款不允许直接存储/缓存 |
| 本地叠加足球热力图后在 Landing 展示 | **需书面确认**：展示自有 App 场景合理，但像素级合成可能落入“修改/衍生”限制；必须保留并避免遮挡 Logo/法定标识 | **需书面许可**：既涉及修改，也涉及后续保存和发布 |
| release artifact / 部署镜像 | **不建议**：会把运行缓存变成持久复制和可转移分发 | **不允许默认采用** |
| Git（包括 Git LFS、私库） | **不提交**：难以满足定期刷新、终止使用和不可转授权边界，还会固化私人活动地点 | **不提交**：与明确的存储、复制和传播限制冲突 |

这里的“对象存储可作为运行缓存”不应被扩大为“地图资产仓库”：缓存对象应私有、只供 AppLog 同一产品展示、设置刷新/失效策略、保留供应商原始标识，并在合同终止或供应商要求时可批量清除。最终活动封面若含第三方底图，也不能因为额外叠加了自有路线或热力图就自动变成可自由再分发的自有图片。

### 修订后的推荐

1. **面向中国大陆，优先与腾讯位置服务确认定制权利，作为国内在线候选第一顺位。** 原因不是功能更多，而是其 Static V2 官方文档明确建议对重复请求缓存并定期刷新，最接近 AppLog 的 worker 模式。采购前必须让腾讯书面确认四件事：服务端调用、私有对象存储的保留周期、本地合成路线/marker/足球热力图、合成图在公开 Landing 的持续展示；同时确认商用价格、额度、出口 IP/域名限制和终止后的旧封面处置。
2. **高德作为第二商务候选，不在普通条款下直接接入当前持久化流程。** 它的静态图 API、当前公开价格、WGS84→GCJ-02 转换、IP 白名单和 SLA 信息都更透明，国内运营能力也很强；但默认协议对缓存、修改和再发布的禁止最明确。只有定制合同逐项放开这些权利后，高德才可能反超腾讯成为更可预测的大陆主供应商。
3. **海外/非大陆仍保留 Stadia `static_cacheable`；供应商选择按活动坐标区域发生在 worker 内。** 大陆活动使用获授权的腾讯/高德并统一转 GCJ-02；其他地区使用 Stadia。不要把 WGS84 路线直接画在大陆 GCJ-02 底图上。
4. **在国内供应商书面授权落地前，不把任一家云静态图写入长期媒体库、release artifact 或 Git。** 可继续用 Protomaps 自渲染做可靠性验证和无外部依赖 fallback，但 ODbL 与中国大陆地图监管是两条不同的许可链：能保存开源数据不等于已获准在大陆公开发布该地图。
5. **无论最终选谁，足球都采用“供应商底图 + 本地热力层”的单一合成管线。** 底图请求只负责地理背景；路线、单点 marker、足球热力图都共享同一个坐标转换、viewport 和安全边距模块。这样可同时解决贴边、无地图和覆盖层错位，而不让供应商 API 各自的 auto-fit 语义决定成图稳定性。

因此，整体排序修订为：**已获书面缓存/合成/再展示许可的腾讯 Static V2（大陆） + Stadia `static_cacheable`（其他地区） + Protomaps 自渲染 fallback**；若腾讯未确认权利，则大陆云服务保持关闭，高德也只进入商务谈判，不以普通 API 条款冒险上线。

## 纯 Protomaps 服务端静态渲染可行性

> 补充日期：2026-07-29。外部技术事实只采用 Protomaps、MapLibre、Martin、TileServer GL 与 Playwright 的官方文档/仓库。下面的资源数字是需要原型实测的项目预算，不冒充上游保证。

### 结论：用 Martin 做本机静态渲染服务

对当前 Python 3.12、Pillow、Linux systemd oneshot worker，最简单且依赖最少的纯本地链路是：

```text
版本化 Protomaps 区域 PMTiles + style + font + sprite
                            │
                            ▼
    applog-map-renderer.service（Martin，127.0.0.1 only）
                            │  static WebP HTTP API
                            ▼
Garmin Python worker ── viewport/timeout/checksum ── Pillow 本地 overlay/缩放
                            │
                            ▼
          现有 garmin_activity_cover 存储
```

Martin 官方当前可以直接读取本地或远程 PMTiles、提供 TileJSON/ZXY、样式、字体和 sprite，并在 Linux 上把选定 camera 渲染成 PNG/JPEG/WebP。静态接口支持 `lon,lat,zoom`、bearing/pitch 或 bbox，以及 `WIDTHxHEIGHT[@SCALE]`；单边最大 2048 px、scale 最大 4，因此 `480x480@2x.webp` 在能力范围内。[PMTiles 文件源](https://maplibre.org/martin/sources-files/)，[样式与静态图接口](https://maplibre.org/martin/sources-styles/)，[字体源](https://maplibre.org/martin/sources-fonts/)，[Sprite 源](https://maplibre.org/martin/sources-sprites/)

它与当前 worker 的契合点：Python 不需要 MapLibre bindings、Node 或 Chromium，只需向 `127.0.0.1` 发有总超时的 GET，验证 HTTP 状态、content type、像素尺寸后交给现有 Pillow 合成路线、单点和足球热力层。当前每轮最多处理少量公开活动且 systemd/db lock 保证 worker 串行；Martin 官方所列“静态渲染暂不支持并发”的限制在这个负载模型下可以接受。Martin 也不缓存静态渲染结果，但最终封面已经按 etag/renderVersion 存进数据库，不需要再引入第二份图片缓存。[Martin 静态渲染限制](https://maplibre.org/martin/sources-styles/)

但必须把 Martin **锁定到一个已验证的精确版本或容器 digest**：官方明确警告当前静态渲染仅 Linux 可用、无并发/无渲染缓存，而且 HTTP shape 可能在 patch release 改变。不能在生产部署里引用 `latest`；升级 renderer 应视同一次封面渲染版本升级。[Martin 安装方式](https://maplibre.org/martin/installation/)，[Martin 静态图警告](https://maplibre.org/martin/sources-styles/)

### 候选路径比较

| 路径 | 能否直接读本地 PMTiles | 480×480 raster 与 viewport | 部署代价 | 判断 |
|---|---|---|---|---|
| **Martin 静态图 API** | 是；本地文件、目录、HTTP/object storage 均是官方源 | center/zoom 或 bbox；PNG/JPEG/WebP；`@2x`；Python 可预先算 camera | 单个预编译 Rust 服务；不要求 Python binding、Node、Chromium 或 Xvfb | **推荐做原型与首个生产实现**；锁版本，保持单并发 |
| **TileServer GL** | 是；当前配置和 `--file` 均明确支持 PMTiles | 静态 API 支持 center、bbox、path auto-fit、百分比 padding、marker、POST、PNG/JPEG/WebP 和 HiDPI，功能最成熟 | Node 20/22/24 + MapLibre Native 及一组 Cairo/Pango/GL/Xvfb 系统依赖；默认 renderer pools 偏向高吞吐，需要主动缩小 | **成熟备选**；若 Martin 的静态接口原型失败，再采用。`tileserver-gl-light` 没有服务端 raster，不能代替。[静态端点](https://tileserver.readthedocs.io/en/latest/endpoints.html)，[PMTiles 配置](https://tileserver.readthedocs.io/en/latest/config.html)，[Linux 依赖](https://tileserver.readthedocs.io/en/stable/installation.html) |
| **MapLibre GL JS + headless Chromium/Playwright** | 是；官方 `pmtiles` JS protocol 可让 MapLibre GL 直接读 archive | `fitBounds` 有 pixel padding/maxZoom，浏览器 viewport 与 DPR 可精确设置，Playwright 能把 canvas/page 截为 buffer | Node + 固定版 Chromium + 本地 HTTP/Range server；需等待 style/tile/font idle，处理 WebGL 软件渲染与浏览器升级差异 | **适合视觉参照原型，不作为首选生产路径**。Playwright 官方也提醒截图会受 OS、浏览器版本、硬件与 headless 模式影响。[PMTiles MapLibre 接入](https://docs.protomaps.com/pmtiles/maplibre)，[MapLibre `fitBounds`](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FitBoundsOptions/)，[Playwright viewport/DPR](https://playwright.dev/docs/api/class-browser)，[截图稳定性说明](https://playwright.dev/docs/test-snapshots) |
| **MapLibre Native `mbgl-render`** | 官方 Linux 示例直接演示本地 MBTiles；PMTiles 可先经 ZXY server 暴露，是否能由该 CLI 直接读 PMTiles 需验证 | 可输出 PNG，但 CLI camera/批量封面契约不如两种 HTTP server 完整 | 要自行构建 C++/CMake 目标并安装 curl/GLFW/ICU/图像库；无显示服务器时官方要求 Xvfb | **不推荐直接嵌入 Python worker**；适合调试底层 Native 渲染。[MapLibre Native Linux/headless 指南](https://maplibre.org/maplibre-native/docs/book/platforms/linux/index.html) |
| **`pmtiles serve` / Martin tile-only** | 是 | 只把 archive 暴露为 TileJSON/ZXY，不生成完整 480×480 raster | `pmtiles` CLI 是无外部依赖单文件，默认 64 MB directory/header cache | **不是完整方案**，只在选 GL JS 或 `mbgl-render` 时作为输入适配器。Martin 已直接读 PMTiles 时不应再多一层。[PMTiles CLI `serve`](https://docs.protomaps.com/pmtiles/cli) |

TileServer GL 的优势是 path auto-fit 和 `padding` 已成文档化接口，还能直接画 marker/path；但当前需求已经决定路线、单点和足球热力统一由 Python/Pillow 合成，没必要为这些 API 能力承担更重的 Node/Native/Xvfb 运行面。Martin 的无并发限制反而能通过单一 worker 的串行请求自然规避。

### Viewport 与 raster 输出

Martin bbox 端点保证按请求尺寸及 bbox/camera 渲染，但它没有文档化的“精确 N 像素路线 padding”参数；其 bbox 适配语义也不是 AppLog 当前 Pillow 裁剪逻辑的直接替代。[Martin camera/bbox 语义](https://maplibre.org/martin/sources-styles/)

因此可靠做法是保留一个供应商无关的 Python viewport 模块：

1. 过滤非法点并处理跨国际日期变更线；将点转换到 Web Mercator。
2. 按最终 480×480 画布和例如 28 px 安全边距求 center 与**浮点 zoom**，单点则采用有上限的固定 zoom。
3. 向 Martin 请求 `center_lon,center_lat,zoom/480x480@2x.webp`，不依赖服务端自动 fit。
4. 在同一 center/zoom 投影上由 Pillow 叠加路线/marker/heatmap，再从 960×960 下采样为 480×480，最后校验轨迹像素 bounds 至少满足安全边距。

这样底图和 overlay 使用同一 camera，路线不会因 renderer 的整数 zoom、bbox 长宽比规则或二次 crop 再次贴边。Martin 文档的 camera 形式允许 zoom 数值，但没有明确承诺小数 zoom、`@2x` 返回的实际像素尺寸及 WebP alpha/色彩行为；这些都列入原型验收，不在调研阶段猜测。如果 Martin 不接受所需的浮点 zoom，就改用 Python 将安全边距反算为扩展后的 bbox，或切换到已明确支持 fit/padding 的 TileServer GL。

### Style、字体、Sprite 的完全离线打包

Protomaps 明确说明完整底图由 tileset、MapLibre style、glyph fontstacks 和 spritesheet 四部分组成；地图站可按指定 flavor 和 style package version 导出静态 JSON，官方 `basemaps-assets` 也提供字体和 sprite ZIP 供自托管/离线使用。[Protomaps MapLibre basemap](https://docs.protomaps.com/basemaps/maplibre)

建议发布包固定为：

```text
maps/releases/<release-id>/
  basemap.pmtiles
  style.json
  fonts/ or raw-fonts/
  sprites/ or sprite-svg/
  manifest.json       # build URL/date, basemap schema, style pkg version, hashes, bbox/maxzoom
  LICENSES/
```

- 不在生产 style 中引用 `protomaps.github.io`、unpkg 或其他外部 URL；Protomaps 的隐私文档明确指出 style、sprite、font 和 JS 都可能形成第三方请求，完整自托管才真正离线。[Security and Privacy](https://docs.protomaps.com/guide/security-privacy)
- 最稳妥的首版 style 是从“Get style JSON”导出的固定 flavor/version，改写 source、glyphs、sprite 为 `127.0.0.1` Martin endpoint。Martin 可从 TTF/OTF/TTC 动态生成 glyph ranges，也可从 SVG 目录生成普通/2× sprite，并缓存这些派生资源。[Martin fonts](https://maplibre.org/martin/sources-fonts/)，[Martin sprites](https://maplibre.org/martin/sources-sprites/)
- 如果选择直接复用 Protomaps 已编译的 `.pbf` fontstack 和 `.png/.json` spritesheet，而不是让 Martin从原始字体/SVG生成，Martin 是否能在同一进程直接托管这些静态文件，官方文档没有给出明确路径；要么在原型中验证 `file://`/本机 URL 行为，要么由现有反向代理增加只监听 loopback 的静态目录。不要在未验证时让 style 静默回退到公网资源。
- 封面内或 Landing 紧邻位置继续显示 `© OpenStreetMap contributors`。Protomaps tiles 是 ODbL Produced Work，styles 的视觉设计为 CC0，部分 icon 另带 MIT 许可，发布包要保留相应 NOTICE。[Protomaps basemaps 许可说明](https://github.com/protomaps/basemaps)

### Linux/systemd 部署面

建议把 Martin 作为独立常驻 `applog-map-renderer.service`，而不是在每次 30 分钟的 Garmin oneshot 内启动/停止：

- 只绑定 `127.0.0.1`；Python worker 是唯一调用方，不把 tiles/style/catalog 暴露公网。
- renderer unit 以同一低权限组运行，配置和 release 目录只读；独立 writable cache/runtime 目录。现有 Garmin unit 的 `ProtectSystem=strict`、`ProtectHome=true`、`PrivateTmp=true` 可继续保留。
- Garmin unit 声明 renderer 的顺序依赖并先探测 `/health`；调用设置短连接/总超时，一次只发一个静态请求。Martin 官方提供 `/health` 与 Prometheus metrics endpoint。[Martin endpoints](https://maplibre.org/martin/using/)
- Python 侧保留现有 local-route/local-pin fallback；renderer 不健康时不得用纯色 fallback 覆盖数据库里已有的成功底图封面。

上游没有给出 Martin 二进制/容器、MapLibre Native renderer、字体缓存的固定磁盘或 RSS 数字，因此现在不能可靠承诺部署体积。预估也不应写入容量规划。原型必须记录：安装/镜像体积、冷启动、空闲 RSS、单张与连续六张的峰值 RSS/CPU、p50/p95、字体与 sprite 首次/热缓存延迟、960→480 后 WebP 大小，以及 CPU-only VPS 上是否需要额外 GL/EGL 软件包。若这些指标超出小型服务器预算，再比较缩小 renderer pool 的 TileServer GL，而不是盲目切换到 Chromium。

### 数据更新、版本固定与回滚

Protomaps v4 planet 提供每日 build、BLAKE3 hash；保留最近一周全部 build 与每个 patch version 的最新 build。区域包可用无外部依赖的 `pmtiles extract --bbox/--region --maxzoom` 生成，`pmtiles verify` 检查 archive，`pmtiles show --metadata` 可记录 OSM 数据时间。PMTiles 本身不能原地更新，必须重写整个文件，这正适合不可变发布和回滚。[Basemap downloads](https://docs.protomaps.com/basemaps/downloads)，[PMTiles CLI](https://docs.protomaps.com/pmtiles/cli)，[PMTiles immutable archive](https://docs.protomaps.com/pmtiles/)

推荐更新流程：

1. 选定明确 daily build URL，不使用“latest”；下载/抽取到新的 `<release-id>` 目录。
2. 校验官方 BLAKE3、运行 `pmtiles verify`，保存 header/metadata、bbox、maxzoom、basemap schema 和配套 style package version 到 manifest。
3. 在临时端口启动同版本 Martin，离线渲染固定城市、短路线、超长路线、单点、足球点列及区域边缘样本，做像素尺寸、非空底图、padding 和 visual snapshot 检查。
4. 通过后原子切换 renderer 配置所指向的 release，并重启 Martin；健康检查成功后才提高 AppLog 的 `renderVersion`，按需逐步重生成封面。
5. 至少保留当前与上一个 release。回滚时把配置切回旧的**完整四件套**（PMTiles + style + font + sprite）并重启；不能只回退 PMTiles，因为 Protomaps v4 build 与 style package 有兼容版本边界。[v4 build/style compatibility](https://docs.protomaps.com/basemaps/downloads)

Martin 能监控目录中的 PMTiles 添加/修改/删除并热更新 catalog，但命名 source 在启动时做 snapshot，不会热更新；为保证 style source ID 稳定和回滚原子性，首版应使用固定 source ID + 显式版本路径 + restart，而不是依赖文件 watcher 或覆盖正在读取的 archive。[Martin hot reload 规则](https://maplibre.org/martin/sources-files/)

### 必须先做的最小原型

纯 Protomaps 在技术上可行，但下面这些是上游文档没有替 AppLog 证明的阻塞未知，正式实现前要做一个不接数据库的 CLI prototype：

1. **Martin static 兼容性**：锁定候选版本后，确认 Protomaps v4 style 的所有 layer/expression、中文字体、sprite、local PMTiles source 都能由 Martin/MapLibre Native 正确渲染。
2. **camera 精度**：确认浮点 zoom、`480x480@2x.webp` 的实际 960×960 输出、经度 180°、极短路线/单点，以及 Python Web Mercator 投影和 Martin camera 的像素误差（目标 ≤1–2 px）。
3. **完全断网**：阻断外网后渲染，记录每个资源请求；任何 font/sprite/style/tiles 公网访问都判失败。
4. **稳定性/资源**：同一进程顺序渲染至少 100 张混合 viewport，验证无 RSS 持续增长、无偶发空白图，量化冷/热延迟和 systemd `TimeoutStartSec=5min` 内的最坏耗时。
5. **更新/回滚**：用两个实际 release 完成一次前进和一次回退，验证旧 cover 不被错误降级、renderer/source/style version 都进入 `renderVersion` 或独立 manifest fingerprint。

若这五项通过，Martin 路线应成为纯 Protomaps 的生产选择；若仅 static endpoint 稳定性或资源打包失败，优先降级到 **TileServer GL + 同一 PMTiles/style/assets**，无需改变 Python worker 的 localhost HTTP contract。Chromium 和手写 MapLibre Native binding 都不进入首版生产范围。
