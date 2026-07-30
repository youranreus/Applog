# Garmin 自包含地图渲染镜像

## Goal

为 AppLog Garmin 活动封面提供一个面向本项目单一场景的 Linux 容器镜像。镜像启动后独立提供 Martin loopback-compatible HTTP contract，包括 `/health`、本地 Protomaps PMTiles、AppLog 浅色样式、本地 Noto 字体和 2× WebP 静态渲染，不依赖运行时公网地图、字体、sprite 或第三方地图 API。

## Background

- 父任务 `07-29-garmin-map-cover-reliability` 已将生产地图方案固定为 Martin `1.11.0`、`@protomaps/basemaps` `5.7.2`、PMTiles CLI `1.31.2`。
- Python worker 只接受 loopback `GARMIN_MAP_RENDERER_URL`，并从 `GARMIN_MAP_RELEASE_MANIFEST` 校验不可变 release、覆盖区域及 render fingerprint。
- 仓库已有 `workers/garmin-sync/maps/martin.yaml`、样式生成器、manifest 模板、公开 fixture、release 验证器与 100 张原型门禁。
- 生产地图包、活动封面和由私人活动区域推导的数据不得进入 Git；镜像产物可以是私有部署制品。
- 当前 systemd 模板假设宿主机原生 Martin；本任务将提供一个无需宿主机安装 Martin/Node/PMTiles CLI 的容器运行边界。

## Requirements

### R1. One-purpose runtime image

- 只支持 AppLog 的 `applog-light` style、单一 `basemap.pmtiles` 和本地字体，不建设通用地图平台。
- 容器内固定 Martin `1.11.0`，以非 root 用户运行，启用只读 root filesystem，并提供容器健康检查。
- 对外保持 worker 已实现的 Martin contract；不得要求修改 Garmin cover 渲染业务语义。

### R2. Fully offline runtime

- 运行时不得访问 Protomaps、OSM、字体 CDN、npm、GitHub 或其他公网服务。
- style 中的 source/glyph URL 只能指向容器自身 Martin 地址。
- PMTiles、style、字体、manifest 和 NOTICE 必须作为一个一致的不可变 release 一起交付。
- 完整 release 直接 bake 进 OCI layer；运行时不得通过 volume、对象存储或 HTTP 补充地图资产。

### R3. Reproducible build

- Docker build 使用显式 Protomaps build 日期/URL和锁定工具版本，不使用 `latest`。
- 多阶段构建可访问公网；生产构建必须从明确的 Protomaps daily build URL
  直接 HTTP Range 提取 global z0-6 与大湾区 z7-15，不得下载或落盘完整
  planet，最终镜像不得包含构建工具或下载入口。
- 官方 BLAKE3 必须非空且格式正确，并仅作为上游 provenance 写入 manifest；
  部分 Range 响应不能被描述为已在本地验证完整源归档。
- 构建阶段验证 PMTiles、资源 SHA-256、manifest、离线 URL 与字体存在性；任一失败则镜像构建失败。
- 生成的 OCI 镜像携带 release id、数据日期、style、renderer 和 attribution 标签。

### R4. Deployment contract

- Linux 上可用一条 `docker run` 或 Compose service 启动。
- 默认只发布到宿主机 `127.0.0.1:3000`；文档不得建议把 renderer 暴露到公网。
- Garmin worker 只需配置 loopback 容器地址和从同一镜像导出的稳定 manifest 路径；不再要求宿主机安装 Martin 或挂载地图资产目录。

### R5. Operations

- 文档覆盖构建、运行、健康检查、原型门禁、版本升级和整镜像回滚。
- 更新地图数据通过构建新镜像完成；旧镜像 tag/digest 可直接回滚。
- OSM attribution 与 Protomaps/字体 NOTICE 必须随镜像交付，Landing 继续展示 `© OpenStreetMap contributors`。

## Acceptance Criteria

- [ ] AC1：在干净 Linux Docker 主机上无需安装 Martin、Node、PMTiles CLI 或字体包即可启动镜像。
- [ ] AC1a：运行容器不挂载任何地图数据 volume；复制或拉取一个 OCI 镜像即可得到完整 release。
- [ ] AC2：断开容器外网后 `/health` 正常，路线与单点静态请求返回有效 960×960 `image/webp`。
- [ ] AC3：镜像只监听容器端口；部署示例仅绑定宿主机 `127.0.0.1:3000`。
- [ ] AC4：构建使用固定 Martin、Protomaps style、PMTiles CLI 与明确 build URL；不存在 `latest` 或运行时下载。
- [ ] AC5：构建时校验合并 PMTiles、manifest 资产 SHA-256、本地字体和 style
  无公网 URL，并验证官方 BLAKE3 provenance 的存在与格式；错误 release
  无法产出镜像。
- [ ] AC6：项目 `map_prototype` 对容器连续渲染 100 张通过，无空白图，且容器运行时无公网请求。
- [ ] AC7：镜像和文档不包含 Garmin token、数据加密密钥、活动坐标、私人派生 bbox 或数据库配置。
- [ ] AC8：新旧两个镜像 tag 能完成前进部署与整镜像回滚，worker 配置无需改变。

## Out of Scope

- 通用化的多租户地图服务、动态上传 tiles/style、管理后台或公网 API。
- 在容器内运行 Garmin worker、NestJS、MySQL 或定时器。
- 自动根据私人活动坐标扩展地图覆盖。
- 云地图供应商、地图 token、CARTO/高德/腾讯/Mapbox 适配。
- 将生产 PMTiles 或私人区域数据提交到 Git。

## Key Decisions

- 完整 Protomaps release 直接打入最终 OCI 镜像，不接受运行时地图数据 volume。
- 镜像体积和月度重建成本是可接受代价；部署和回滚以 immutable image digest 为唯一原子单元。
- 构建可联网，运行必须完全离线。
