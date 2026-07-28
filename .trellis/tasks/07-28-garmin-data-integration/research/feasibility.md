# Garmin 运动数据接入可行性调研

调研日期：2026-07-28

## 结论摘要

技术上可行，但“Garmin 官方直连”不适合作为个人博客 MVP 的唯一前提：Garmin Connect Developer Program 官方 FAQ 明确只面向 business / enterprise use，必须申请并经审批。Strava 原本是自动化程度最高的官方中转路径，但 Strava 官方当前将中国列为服务部分或完全受限地区，而 AppLog 后端部署在深圳，因此不能把它作为本项目的稳定生产依赖。大陆部署下，**FIT 文件导入** 是最稳妥的官方数据路径；非官方 Garmin Connect 接口可以做个人实验，但不应默认作为公开站点的长期生产依赖。

## 路径对比

| 路径                                  | 自动化                                                     | 数据范围                                                       | 准入/成本                                                          | 稳定性与合规                                                                   | 适合度                                                   |
| ------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Garmin Activity API                   | 高，支持 push 或 ping/pull                                 | 30+ 活动类型、完整活动详情，可取 FIT/GPX/TCX                   | 只面向 business/enterprise，需申请审批；常规 Program 无许可/维护费 | 官方、OAuth 2.0、长期最稳；展示还须遵守 Garmin attribution                     | 理想终态，但个人博客获批不确定，不宜阻塞 MVP             |
| Garmin Health API                     | 高                                                         | 步数、心率、睡眠、压力、Body Battery 等全天健康指标            | business/enterprise；部分指标/商业用途可能付费                     | 官方、OAuth 2.0；健康数据更敏感                                                | 只有明确要展示/分析全天健康数据时才值得申请              |
| Garmin → Strava → Strava API          | 高；Garmin 官方支持自动同步，Strava 支持 OAuth/API/Webhook | 活动摘要、详情和流；不等同 Garmin Health，不含完整全天健康指标 | 单账号模式开箱可用，但当前创建 Strava API app 需要订阅             | Strava 官方将中国列为受限地区，App/同步可能中断；深圳后端到 API 的可用性无 SLA | 仅适合境外后端或可接受中断的实验，不推荐当前大陆生产部署 |
| Garmin 导出 FIT/GPX/TCX → AppLog 导入 | 低，需人工导出/上传；可批量初始化                          | FIT 可含时间、运动类型、lap、GPS、传感器等详细活动数据         | 无 Developer Program 审批；官方 FIT SDK 提供 JS decoder            | 官方文件格式、最可控；同步不实时，需构建上传/去重流程                          | **无 Strava 时的推荐保底路径**                           |
| 非官方 Garmin Connect API wrapper     | 中高，可定时拉取                                           | 社区库暴露活动和大量健康指标                                   | 无官方审批，但需账号登录/SSO token，可能涉及 MFA                   | 逆向接口，无稳定契约；可能 401/429/风控或突然变更；生产合规与凭据风险最高      | 仅本地 PoC，默认不推荐部署到公开生产环境                 |

## 官方证据

### Garmin Connect Developer Program

- [Program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/)：Program 仅面向 business / enterprise use；常规访问无 licensing/maintenance fee，部分指标可能要求许可费或最低设备采购；所有 API 使用 OAuth 2.0；典型集成周期官方估计为 1–4 周。
- [Activity API](https://developer.garmin.com/gc-developer-program/activity-api/)：提供 30+ 活动类型的详细数据，支持 REST、push 或 ping/pull、历史 backfill，并可访问 FIT/GPX/TCX 文件；必须先获批。
- [Health API](https://developer.garmin.com/gc-developer-program/health-api/)：提供全天步数、心率、睡眠、压力、血氧、Body Battery 等；商业使用注明需要支付许可费。
- [API Brand Guidelines](https://developer.garmin.com/downloads/brand/Garmin-Developer-API-Brand-Guidelines.pdf)：仪表盘、活动流、概览卡等展示 Garmin 设备来源数据时，需要在标题附近标注 `Garmin [device model]`；设备未知时至少标注 Garmin 数据源。

### 文件导出与解析

- [Garmin 数据导出支持](https://support.garmin.com/en-IN/?faq=W1TvTPW8JZ6LfJSfK512Q8)：单条活动可导出原始文件（通常 FIT）、GPX、TCX 或 splits CSV；也可请求账号全量数据导出。
- [FIT Activity 文件](https://developer.garmin.com/fit/file-types/activity/)：可记录日期时间、运动类型、lap/split、GPS 轨迹、传感器数据和事件。
- [FIT SDK](https://developer.garmin.com/fit/get-the-sdk/)：官方提供 JavaScript SDK，支持 FIT 解码和编码，能直接适配本项目 TypeScript/Node 后端。

### 经 Strava 的自动化路径

- [Garmin 官方支持：连接 Strava](https://support.garmin.com/en-US/?faq=4uYoMd5zEt22rg0iehnro9)：Garmin Connect 活动可自动同步到 Strava；首次连接会同步过去一年和未来活动。
- [Strava API Getting Started](https://developers.strava.com/docs/getting-started/)：REST API 包含 athlete/activity/route/gear；新 app 默认 single-player，只允许自己的账号；当前创建 app 需要 Strava subscription；默认读请求限额远高于个人博客需求。
- [Strava OAuth](https://developers.strava.com/docs/authentication/)：OAuth 2.0，access token 约 6 小时过期，refresh token 轮换；可用 `activity:read` 避免读取 Only You 活动和 privacy-zone 数据，若需私有活动才用 `activity:read_all`。
- [Strava Rate Limits](https://developers.strava.com/docs/rate-limits/)：默认 non-upload 100 次/15 分钟、1000 次/天；单站长低频同步充足。官方建议 webhook 替代轮询。
- [Strava 在部分国家/地区的可用性](https://support.strava.com/en-us/articles/15401978-strava-availability-in-certain-countries)：官方当前将 China 列为可能部分或完全限制服务的地区，并提示 App 访问和活动同步可能出现问题或中断。这是明确的产品支持风险，不应通过一次连通性测试推导长期稳定。

## 非官方接口证据与风险

- [python-garminconnect](https://github.com/cyberjunky/python-garminconnect) 展示了社区路径：使用 Garmin 移动端 SSO、token 自动刷新并支持 MFA，暴露活动和健康数据。但它并非 Garmin Developer Program 的公开契约；其能力只能证明“目前能调用”，不能证明 Garmin 授权、稳定性或未来兼容。
- 将 Garmin 主账号密码存入 AppLog 比 OAuth token 风险更高。即便社区库改为持久化 token，登录风控、MFA、限流和 endpoint 变更仍可能导致无人值守同步失效。

### 开源库候选（2026-07-28）

| 库                                                                                      | 语言/许可          | 维护与能力                                                                | 中国区/鉴权                                                             | 结论                                                    |
| --------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| [`cyberjunky/python-garminconnect`](https://github.com/cyberjunky/python-garminconnect) | Python 3.12+ / MIT | 2.7k stars、700+ commits、142+ endpoint；实现时 PyPI 最新可安装版为 0.3.7 | MFA、DI OAuth token 持久化与自动刷新、多策略登录、区域 token 校验       | **首选 PoC 库**；成熟度最高，但要增加独立 Python worker |
| [`@flow-js/garmin-connect`](https://github.com/florianpasteur/garmin-connect)           | TypeScript / MIT   | 活动列表/详情/原始文件、健康数据、token 导入导出；npm 近期有发布          | README 未说明 MFA；要求用户名密码完成初次登录                           | 与 NestJS 集成最轻，但鉴权鲁棒性和社区规模弱，作为备选  |
| [`@gooin/garmin-connect`](https://github.com/gooin/garmin-connect-cn)                   | TypeScript / MIT   | 近期 fork，支持活动、token 保存与刷新                                     | 明确支持 `garmin.cn` 和 `garmin.com`，但 README 仍把 MFA、单测列为 TODO | 中国账号专项实验候选，不宜在未验证 MFA/测试前作为首选   |
| `matin/garth`                                                                           | Python / MIT       | 曾是底层主流方案                                                          | 2026 年登录限流/新登录变化已有公开问题，多个新库已自行扩展鉴权          | 不建议新项目直接选用                                    |

`python-garminconnect` 最新文档明确：首次登录经 Garmin 移动 SSO，MFA 回调取得验证码；后续持久化 access/refresh token 并自动刷新。它也明确自称 unofficial client，refresh token 等同长期账号访问能力。若采用，应只调用读取活动/下载数据的方法，并在 AppLog 自己的适配器层隔离所有库响应。

认证材料分为两个阶段：

1. 首次建立会话：Garmin Connect 邮箱/用户名、密码；若账号开启 MFA，还需要当次验证码。不需要官方 Developer Program 的 client id、client secret 或 API key。
2. 后续无人值守同步：库生成并保存 DI OAuth access token 与 refresh token；access token 到期前会自动刷新。只要 refresh token 未失效/撤销，通常不再需要密码或 MFA；失效后需要重新交互登录。

生产环境推荐只保存加密后的 token store，不保存 Garmin 密码。首次登录在本地/受控管理命令完成，成功后将 token 注入 worker。token 日志、错误正文、fixture 和数据库读回接口都必须脱敏；token 泄漏后的处置是从 Garmin 账号安全设置撤销会话并重新登录。

现有阿里云函数为 Node 20 layer、512 MB、6 秒 timeout（`s.yaml:20-36`）。把 Python 3.12、`curl_cffi` 和登录流程塞进同一函数会增加冷启动和部署不确定性。因此更合理的形态是独立低频 Python 同步 worker 写入 MySQL，NestJS 只读取已经裁剪的活动快照；worker 失败不影响公开页面。

## 项目适配证据

- 后端是 NestJS + TypeORM/MySQL，模块以 `AppModule` 聚合；新增 Garmin/Strava 模块在结构上无障碍：`packages/backend/src/app.module.ts:8-55`。
- 生产配置使用阿里云函数计算深圳地域：`s.yaml:5-17`。即使浏览器端偶尔能打开 Strava，也不能据此保证深圳函数长期稳定访问 Strava OAuth/API。
- Duolingo 已实现“管理员配置敏感凭据 → 后端抓取/聚合 → 成功与失败缓存 → 公开接口软降级”：`packages/backend/src/module/duolingo/duolingo.service.ts:42-146`、`packages/backend/src/module/duolingo/duolingo.controller.ts:15-48`。
- 公共 DTO 已明确排除用户名、第三方 userId、JWT 和原始 payload，可作为 Garmin 公开 DTO 的安全边界模板：`packages/common/src/types/duolingo.ts:27-46`。
- Landing 已有独立数据 hook 和条件渲染的统计区块，可自然追加运动统计：`packages/frontend/src/pages/Landing/index.vue:23-26`、`:89-99`。
- 当前 Duolingo 只使用进程内缓存。活动历史需要去重、分页和重启后保留，因此 Garmin/Strava 接入应新增持久化 activity snapshot，而不是简单复制内存缓存。

## 推荐 MVP（待产品意图确认）

用户已确认目标是公开展示运动生活，MVP 展示活动类型、日期、距离、时长、累计次数，并允许使用 GPS 生成跑步路线预览：

1. 只接入“已完成活动”，不接入睡眠、压力、Body Battery 等全天健康数据。
2. 大陆部署下优先采用 FIT 文件上传。Garmin → Strava → AppLog 只保留为未来迁移到境外同步 worker 后的候选，不作为 MVP 必需依赖。
3. Strava 官方文档说明 activity 请求可返回使用 Google encoded polyline 编码的 `summary_polyline`，足以在 AppLog 内生成轻量路线预览，无需下载完整逐点 stream。
4. `activity:read` 可读取 Everyone/Followers 活动并排除 privacy-zone 数据；不应为了路线图默认申请 `activity:read_all`。Garmin 活动设为公开本身不会产生无需审批的 Garmin API：Garmin Activity API 仍要求 Program 审批，Strava API 的所有请求也仍需 OAuth。
5. 后端持久化经过隐私裁剪的活动快照，以第三方 activity id 或 FIT identity 去重；公开接口只返回白名单 DTO。路线可存裁剪/简化后的 polyline 或预生成 SVG/图片，不保存原始 FIT。
6. 默认公开聚合指标和路线预览，不公开原始 GPS 下载、精确开始时刻、逐秒心率或其他健康 stream。
7. 明确标注 Garmin 数据来源与同步时间；上游失败时展示最近成功快照并标为 stale。

## 最小验证实验

在实施前，用一条真实活动验证目标路径返回/解析的数据字段：运动类型、开始时间、时长、距离、设备型号、平均心率以及轨迹存在性；记录缺失字段。实验只保留脱敏样例 fixture，不提交 token、原始 GPS 或真实账号数据。

## 尚需用户决定

- 用户已拒绝人工 FIT 上传，并确认接受以 `python-garminconnect` + 独立 Python worker 做只读 PoC；首次在可信本地环境完成密码/MFA 登录，生产只保存加密 token，失效后人工重新认证。相关非官方接口、登录风控与未来适配成本已作为明确接受的风险。
- 用户已选择抽象 SVG 路线线稿，不使用地图底图，并要求展示从起点到终点的完整路线；不裁剪首尾轨迹的位置隐私风险由用户明确接受。
