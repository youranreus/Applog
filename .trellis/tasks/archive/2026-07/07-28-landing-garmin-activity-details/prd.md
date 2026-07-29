# Landing Garmin 活动明细与地图交互

## Goal

完整采集并长期保存站长 Garmin 当前可获取的活动、逐点运动与全天健康数据，为后续统计和展示预留真实历史；同时把 Landing 最近活动升级为以地图/路径为核心、可悬停偏转并从原卡片放大展开详情的体验。

用户价值：

- 当前暂未展示的字段不会丢失，后续功能可以基于真实历史而非重新抓取或猜测。
- 户外活动通过地图与路径形成空间记忆，室内活动也有一致而明确的视觉封面。
- 不同运动只突出真正有意义的指标，Landing 仍保持安静、克制和阅读优先。

## Background and Evidence

- 当前链路是独立 Python worker → MySQL `garmin_activity_snapshot` → NestJS 白名单 DTO → Vue Landing；公开请求从不直连 Garmin。
- 当前 worker 只拉最近 12 个月且只持久化 `public/everyone` 活动，超过窗口会删除；详情端点只为跑步类提取路线，每轮最多处理 12 条。
- 当前公开快照仅有活动类型、时间、距离、时长、卡路里、粗粒度地点、设备名和不可反解 SVG，不是完整活动仓库。
- `garminconnect==0.3.7` 提供 activity summary/details、splits、typed splits、split summaries、天气、心率/功率区间、gear、FIT，以及按日健康读取能力。
- 2026-07-28 已使用真实中国区账号做只读脱敏探测，共覆盖 272 条活动和全部八类目标运动；没有记录 activity id、坐标、日期、地点或实际健康数值。
- 真实 type key：足球 `soccer`、户外跑步 `running`、操场跑步 `track_running`、跑步机 `treadmill_running`、椭圆机 `elliptical`、有氧运动 `indoor_cardio`、爬山机 `stair_climbing`、骑行 `cycling`。
- 跑步类样本具有功率与跑姿指标；足球具有 GPS/速度/步频/心率；骑行样本具有 GPS/速度/海拔/心率；室内运动以心率、Body Battery、时长及条件步频为主。
- 健康响应已确认身体电量、压力、睡眠、HRV、血氧、呼吸、补水、强度分钟和身体组成；全天心率、步数、静息心率存在客户端端点，本次样本连接失败，必须按条件数据容错。
- 完整脱敏矩阵见 `research/field-capability.md`；地图渲染比较和官方 tile policy 证据见 `research/map-rendering.md`。

## Requirements

### R1. 私有活动全量采集

- 采集所有 Garmin 活动类型，而不仅限于公开活动或八类展示预设；未知/未来类型也保留原始数据。
- 私有层允许保存非公开活动、Garmin activity id/UUID、精确 GPS、逐点时间序列、心率、功率、步频等运动数据。
- 对每条活动按能力读取 list、summary、details、splits、typed splits、split summaries、天气、HR/功率区间、gear 和 FIT；单个条件端点缺失不使整条活动失败。
- 原始 JSON/FIT 加密保存，同时建立查询友好的规范化摘要；上游字段、schema/抓取版本、内容 hash 和抓取时间可诊断。
- Garmin 适配器只暴露读取/下载能力，不允许上传、修改或删除。

### R2. 全天健康数据采集

- 私有层保存身体电量及事件、压力、全天/静息心率、步数、睡眠、HRV、血氧、呼吸、补水、强度分钟和身体组成。
- 按 Garmin 自然日幂等同步，保存 `calendarDate` 及可用的本地/GMT 边界，不能按服务器 UTC 日错误归档。
- 各健康域独立容错；无数据与数值 `0` 保持不同语义。
- 本期不为健康数据新增公开或管理员展示接口；后续公开需要新的粒度、白名单和隐私评审。

### R3. 全历史回填、长期保留与增量同步

- 首次同步分批回填 Garmin 当前仍可返回的全部活动和健康历史，并可断点续跑。
- 已采集数据长期保留，不再采用 12 个月滚动删除。
- 每次定时任务优先刷新近期活动和今天/昨天健康数据，再推进一个有上游请求预算的历史批次。
- 增量阶段持续回查近期窗口，以吸收 Garmin 迟到写入和活动修改。
- 删除或改隐私的活动只退出公开投影；私有历史保留并记录 reconciliation 状态。

### R4. 私有数据与公开投影隔离

- 新建私有归档、加密 payload、规范化活动/健康摘要和分流游标；现有 `garmin_activity_snapshot` 继续作为明确的公开读模型。
- 原始 payload 使用独立于 token 的 AES-256-GCM 数据密钥；日志不得包含 id、日期、位置、健康值或 payload。
- 采集到数据库不等于公开。公开 API 永不自动透传 source id、坐标、FIT、逐点数据、私有可见性或全天健康数据。
- 公开活动只来自 Garmin 明确的 `public/everyone`，并使用随机、不可由 source id 推导的 `publicId`。

### R5. 地图与路径封面

- 有有效 GPS 的公开候选由 worker 使用开源 `py-staticmaps` + Pillow 生成深色底图与完整路径结合的静态 WebP。
- 以 2 倍尺寸渲染，路线 bbox 保留显著边距，LANCZOS 缩小后编码 WebP；图片不得含 EXIF/GPS metadata。
- 地图 provider、tile URL、attribution 和 User-Agent 配置化；不得把禁止后台/offline 预取的 `tile.openstreetmap.org` 用作历史生成源。
- 只为当前公开候选生成并缓存封面，不为全部私有历史批量预取瓦片。
- 地图图片存独立媒体表，通过随机 `coverId` 提供；Landing 浏览器不接收坐标，也不直接请求地图瓦片。
- 无 GPS/室内运动使用本地生成的安静深色中心图钉封面，不伪造路线。
- provider 或渲染失败不影响数据同步；保留最后成功图片，首次失败回退到现有抽象路线封面。

### R6. 公开活动详情

- `GET /garmin/stats` 继续返回最近六条公开活动摘要，并增加安全的 `publicId` 和封面描述。
- 新增按 `publicId` 懒加载的公开详情接口；只有仍在公开投影中的活动可读。
- 详情层采用摘要优先：顶部 3–4 个核心指标、下方 4–6 个类型化次级指标；适合分段的活动增加简短 lap/split。
- 本期不展示逐点心率、速度或功率趋势图；数据仍完整采集，留给后续训练分析体验。
- 指标缺失时省略，不能用 `0` 或推导值伪装缺失。

活动预设：

| 活动 | 核心指标 | 次级指标 |
|---|---|---|
| 足球 | 用时、移动距离、消耗 | 平均/最高心率、最高速度、训练效果 |
| 户外跑步 | 距离、用时、平均配速 | 平均/最高心率、爬升、步频、功率、训练效果 |
| 操场跑步 | 距离、用时、平均配速、圈数 | 平均/最高心率、步频、功率、简短分段 |
| 跑步机 | 距离、用时、平均配速 | 平均/最高心率、步频、功率、训练效果 |
| 骑行 | 距离、用时、平均速度 | 最高速度、平均/最高心率、爬升；功率/踏频条件展示 |
| 椭圆机 | 用时、消耗、平均心率 | 最高心率、步频、训练效果；距离不作主指标 |
| 有氧运动 | 用时、消耗、平均心率 | 最高心率、训练效果、Body Battery 变化 |
| 爬山机 | 用时、消耗、平均心率 | 最高心率、步频、训练效果 |

### R7. 卡片与共享元素详情交互

- 保留横向活动轨道；地图/图钉封面成为卡片视觉焦点，指标保持低密度。
- 仅在精细指针设备上 hover：卡片轻微放大，并按指针相对位置产生受控 3D 偏转；离开、失焦、滚动或打开详情时复位。
- 点击/键盘激活后打开响应式 Reka Dialog：桌面大尺寸左右布局，移动端近全屏纵向布局。
- 使用 FLIP/WAAPI 临时视觉克隆，从原卡片实际位置、尺寸、圆角连续放大到详情；关闭时反向缩回当前原卡片。
- 动画不改变 URL；Dialog 负责焦点锁定、Escape 和关闭后焦点归还。
- `prefers-reduced-motion`、动画取消、窗口尺寸变化或原卡片不可见时降级为无空间移动的淡入淡出。
- 详情立即以摘要打开并懒加载；失败保留封面和摘要，提供克制的重试。

### R8. 韧性、部署与回滚

- 同步使用全局上游请求预算、single lease、分类错误和按流游标；一个域失败不推进其游标，也不回滚其他成功域。
- 认证失败进入 `reauth_required`；限流和 provider 故障保留所有旧快照/封面。
- 统一 `GARMIN_MYSQL_*` 与 FC `MYSQL_*` 的环境契约，避免本地/systemd/FC 行为漂移。
- 先部署 TypeORM schema，再启用新 worker；生产前备份 Garmin 表并检查 `synchronize` 生成的 schema diff。
- 私有回填、健康回填、地图封面和公开详情/UI 可独立关闭；回滚不删除已采集数据。

## Acceptance Criteria

- [ ] AC1：形成八类活动与健康域的字段能力矩阵，标明来源、稳定性、单位/类型、可空性、存储与公开策略，且不含真实敏感值。
- [ ] AC2：所有活动类型可按 activity id 幂等归档；目标八类保存完整可用端点与 FIT，单个条件端点失败只标记 partial。
- [ ] AC3：身体电量、压力、全天/静息心率、步数、睡眠及相邻健康域可按 Garmin 自然日独立幂等同步。
- [ ] AC4：活动与健康全历史回填可断点续跑至 Garmin 可返回的最早边界；重复执行不重复数据，近期修改可被回查吸收。
- [ ] AC5：已采集历史不会因滚动窗口删除；上游删除/隐私变化只撤销公开投影。
- [ ] AC6：私有 raw payload/FIT 以独立数据密钥加密；公开 JSON、图片 metadata、日志和浏览器请求均不包含 source id、坐标、私有健康/逐点数据。
- [ ] AC7：`GET /garmin/stats` 仍最多返回最近六条公开活动；采集层扩展不会自动扩大公开字段。
- [ ] AC8：有 GPS 的公开候选生成并缓存带 attribution 的 WebP 地图路线封面；室内/无 GPS 生成中心图钉封面。
- [ ] AC9：地图 provider 失败时保留旧封面或回退抽象路线，活动与健康同步仍可成功。
- [ ] AC10：按随机 `publicId` 可懒加载仍公开活动的白名单详情；私有或退出投影的活动不可读取。
- [ ] AC11：八类活动按预设展示摘要和条件分段；缺失指标省略，椭圆机距离不作主指标，本期无逐点趋势图。
- [ ] AC12：精细指针 hover 有受控放大/偏转并可靠复位；键盘和触摸不依赖 hover。
- [ ] AC13：详情从触发卡片连续放大、关闭时缩回；键盘、Escape、焦点归还、移动端与 reduced-motion 行为可验证。
- [ ] AC14：同步、加密、数据库 SQL/TypeORM 对齐、公开白名单、图片响应、指标格式和交互均有专项自动化测试或可复现回归步骤。
- [ ] AC15：真实账号 staging PoC 只报告数量、状态和错误分类，不记录或提交真实 payload/健康值。

## Out of Scope

- 本期公开身体电量、睡眠、压力、全天心率或其他健康数据。
- 逐点趋势图、训练负荷分析、健康建议或完整活动历史浏览页。
- 多 Garmin 账号、访客 Garmin 授权或任何 Garmin 写入/上传/修改/删除。
- 申请 Garmin 官方 Developer Program 或把 Strava 作为生产中转。
- 自托管完整 OpenMapTiles/tile server；地图 provider 通过配置保持可替换。
- 用伪造数据生成足球热力图、室内路线或缺失指标。

## Risks and Deferred Items

- `python-garminconnect` 是非官方契约；通过加密 raw archive、adapter fixture、schema version 和按域失败隔离降低变化风险，但没有官方 SLA。
- 全历史活动详情、FIT 和逐日健康回填请求量大；必须以增量优先、全局预算和持久游标渐进完成，不能在一次 invocation 内抓完。
- 生产 tile provider 的 CDN 使用条款、深圳可达性和 attribution 必须在启用地图流前复核；provider 可替换但不改变公开契约。
- 私有健康/位置数据的密钥丢失会导致 archive 不可恢复；数据密钥必须纳入部署 secret 备份与版本化轮换。
- MySQL `synchronize: true` 与 Python 直接 SQL 同时存在；上线前必须做 schema diff、备份和列名/类型一致性测试。
- WebP 地图即使没有坐标 metadata，也可能让熟悉地点的访客识别路线；用户已接受公开完整路线的既有位置风险。

## Artifact Status

- `prd.md`：已完成 requirement convergence 与 PRD convergence pass。
- `design.md`：已完成跨 worker、数据库、common、backend、frontend 的技术设计。
- `implement.md`：已完成顺序、验证命令、风险文件和回滚点。
- `research/field-capability.md`：已完成真实账号脱敏字段矩阵。
- `research/map-rendering.md`：已完成开源 renderer 与 tile policy 调研。
- Blocking open questions：无。
