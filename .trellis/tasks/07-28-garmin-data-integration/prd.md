# Garmin 运动数据公开展示

## Goal

在 AppLog Landing 公开展示站长的 Garmin 运动数据，让读者看到长期运动积累和最近活动，并通过抽象 SVG 感知完整跑步路线；同步过程自动运行，不暴露 Garmin 密码、token、原始轨迹文件或非展示所需的健康数据。

## Background and Confirmed Facts

- AppLog 是个人公开写作空间，已有天气与 Duolingo 公开统计，可复用“后端聚合白名单 DTO、上游失败软降级、Landing 条件展示”的产品模式（`packages/backend/src/module/duolingo/duolingo.service.ts:42-146`、`packages/common/src/types/duolingo.ts:27-46`、`packages/frontend/src/pages/Landing/index.vue:23-99`）。
- Garmin Connect Developer Program 官方 API 只面向 business/enterprise 且需要审批，不适合作为个人博客 MVP 前置条件。
- Strava 官方将中国列为服务可能部分或完全受限的地区；AppLog 部署于阿里云深圳（`s.yaml:5-17`），因此 Strava 不作为生产依赖。
- 用户拒绝人工 FIT 上传，接受非官方 `python-garminconnect` 的登录风控、接口变更和后续适配成本，以换取自动同步。
- `python-garminconnect` 支持中国区账号、MFA、token 持久化/刷新、活动总数、按日期分页读取、活动详情及 GPX/FIT 下载；它需要 Python 3.12+。
- 阿里云函数计算深圳地域支持 Python 3.12 和定时触发器，可将同步 worker 与现有 Node Web 函数隔离。
- 用户接受首次在可信本地环境输入 Garmin 邮箱、密码和 MFA；生产只保存加密 token，不长期保存 Garmin 密码，token 失效后由管理员重新认证。
- 用户要求 SVG 保留从起点到终点的完整路线，不裁剪首尾，并明确接受完整路线轮廓带来的位置隐私风险。

## Requirements

### R1 — Automatic read-only synchronization

- 使用独立 Python 3.12 worker 和 `python-garminconnect`，只调用读取、计数和下载接口，不调用上传、修改或删除 Garmin 数据的接口。
- worker 由阿里云函数计算定时触发；正常运行无需用户操作。
- 首次及持续同步只在本地保留最近 12 个月的公开活动详情；分页/路线处理可跨 invocation 断点续跑。
- 同步 Garmin 全部历史活动总数，作为公开“累计次数”；活动详情只存 Garmin 侧公开的活动，缺失或隐私状态无法确认时默认不发布。

### R2 — Credential security

- 首次登录在可信本地环境完成，支持 MFA，生产环境不保存 Garmin 密码。
- access/refresh token 以 AES-256-GCM 等带认证加密方式存入 MySQL；加密密钥只存在 worker 环境变量中，不下发 NestJS、前端或日志。
- token 刷新后原子替换密文；认证失效时停止重复登录，记录 `reauth_required`，保留最近成功数据。

### R3 — Public data contract

- Landing 最多展示最近 6 条已同步的公开活动，字段仅包括：活动类型、活动日期、距离、时长、可选设备来源和可选路线预览。
- 同时展示 Garmin 全部历史活动累计次数、最近成功同步时间和过期状态。
- 公开 DTO 不包含 Garmin activity id、账号标识、经纬度、原始 GPX/FIT、逐秒心率或第三方原始 payload。
- 睡眠、压力、Body Battery、全天心率、血氧和其他健康指标不进入 MVP。

### R4 — Full-route abstract SVG

- 对包含 GPS 的跑步活动生成抽象 SVG 路线；完整保留首尾点，不做位置裁剪。
- 经纬度仅在 worker 内存中短暂存在，经投影、简化和归一化后保存为受限 SVG path 数据；不保存原始 GPX/FIT 或可反解的经纬度数组。
- SVG 不使用地图底图、地名、坐标轴、地图瓦片或第三方地图服务。
- 无 GPS、室内活动、解析失败或非法路径时仍展示活动卡片，但不展示路线图。

### R5 — Resilience and publication safety

- 同步按 Garmin activity id 幂等 upsert；同一活动不得重复计数或生成重复卡片。
- 上游超时、限流、schema 变化或路线解析失败不得破坏现有快照；公开 API 返回最近成功数据并标记 `stale`。
- 活动被删除、改为非公开或滑出 12 个月窗口后，应在后续成功 reconcile 中停止公开展示。
- 日志只记录阶段、错误类别、activity 数量、耗时和 request id，不记录密码、token、完整响应、经纬度或 GPX/FIT 内容。

### R6 — Landing experience

- Garmin 区块遵循 AppLog 阅读优先、低信息密度的视觉原则，并与现有 Landing 区块保持节奏一致。
- 数据不可用且从未成功同步时不渲染区块；已有快照但同步过期时继续展示并给出克制的过期提示。
- 路线 SVG 具有可访问名称；纯装饰信息不重复进入读屏顺序。
- 数据来源明确标注为 Garmin Connect；若设备型号可靠可用，则显示 `Garmin <device model>`。

## Acceptance Criteria

- [ ] AC1：配置有效加密 token 后，定时 worker 能只读获取全部历史活动总数，并最终完成最近 12 个月公开活动的断点回填。
- [ ] AC2：Landing 公开接口最多返回最近 6 条活动，按日期倒序，字段仅符合 R3 白名单；累计次数来自 Garmin 全部历史总数。
- [ ] AC3：公开活动包含 GPS 跑步轨迹时显示完整首尾的抽象 SVG；无轨迹活动正常显示但没有空白或损坏的 SVG。
- [ ] AC4：重复执行同步不会产生重复记录；活动删除、改为非公开或滑出窗口后，下一次成功 reconcile 会停止展示。
- [ ] AC5：Garmin 暂时不可用时仍返回最近成功快照并标记 `stale`；首次同步从未成功时 API 返回 `null`，Landing 其他内容不受影响。
- [ ] AC6：token 失效时状态变为 `reauth_required`，worker 不进行高频密码登录；管理员重新 provision token 后可恢复同步。
- [ ] AC7：仓库、日志、公开 API、前端 bundle、测试 fixture 中均不存在 Garmin 密码、明文 token、原始 GPX/FIT 或经纬度数组。
- [ ] AC8：后端、前端、common 和 Python worker 的单元测试及构建检查通过；路线算法覆盖单点、重复点、跨纬度、无效数字和完整首尾保留。

## Out of Scope

- 申请或集成 Garmin 官方 Developer Program API。
- 使用 Strava、真实地图底图、地图瓦片、地理编码或 GCJ-02 转换。
- 人工 FIT 上传界面、完整活动历史页、分页浏览全部历史、活动详情页或原始轨迹下载。
- 展示或分析睡眠、压力、Body Battery、全天/逐秒心率、血氧、训练建议等健康指标。
- 多 Garmin 账号、多站点用户授权、向 Garmin 写入活动/训练计划或修改账号数据。
- 对完整路线首尾做隐私区裁剪；该位置风险已由用户明确接受。

## Risks and Deferred Items

- 非官方 Garmin endpoint 或登录策略可随时变化；通过独立适配器、持久化快照、低频请求和 `reauth_required` 降低影响，但无法提供官方 SLA。
- Python 3.12 在阿里云函数计算当前为 public preview；worker 与 Web 请求链路隔离，必要时可迁移到自定义镜像/常驻容器而不改公开 API。
- 路线轮廓即使没有坐标也可能被熟悉地点的人识别；MVP 按用户决定保留完整路线，未来可增加可选隐私裁剪。
- `python-garminconnect` 响应不是稳定契约；真实账号 PoC 必须先验证中国区账号、活动公开字段、设备字段和路线 payload，再冻结内部 adapter fixture。

## Research

- 路径对比、官方来源、开源库比较和项目适配证据见 `research/feasibility.md`。
