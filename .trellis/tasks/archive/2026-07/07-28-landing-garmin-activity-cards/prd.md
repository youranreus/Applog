# 优化 Landing Garmin 运动记录展示

## Goal

让 Landing「最近的运动」成为安静、可读的横向活动卡片带：中文活动名、带 icon 的指标行、上栏视觉按「有 GPS 轨迹 / 类型化 SVG 封面」分流，溢出时可横滑且仅在可滚动时显示边界渐变。

## Background

- 现有组件：`packages/frontend/src/pages/Landing/components/LandingGarminStats/`
- 公开契约 `IGarminLandingActivity` 仅有 type / typeDisplay / date / distanceMeters / durationSeconds / deviceSource / route
- 当前 UI：2 列网格、左右分栏；无 route 时文案「室内 / 无 GPS」；距离缺失显示「距离暂无」
- Worker `TYPE_LABELS` 未覆盖 elliptical / track_running / soccer 等
- GPS 路线仅对跑步类拉取并归一化为无地理语义 SVG
- 隐私边界不变：公开面不返回原始坐标 / GPX / 账号

## Key Decisions

| 决策 | 结论 |
|------|------|
| 数据范围 | 方案 A：worker/DB/API 增补 `calories` + 粗粒度 `locationName`；仍不落 lat/lon |
| 足球热力 | **不做**示意热力图；足球与其它无 GPS 活动一样用静态 SVG 封面 |
| 上栏分流 | 有安全 route → GPS 轨迹 SVG；否则 → 按 `type` 的静态 SVG 封面 |
| 可选字段 | 地点、距离无数据时**省略**（不再显示「暂无」）；消耗无数据时同样省略 |
| 中文名 | Worker `TYPE_LABELS` 为权威源；同步 upsert 会刷新已落库的 `activityTypeDisplay` |

## Requirements

### R1 — 活动类型中文
- 扩展 `TYPE_LABELS`，至少包含：`elliptical`→椭圆机、`track_running`→操场跑步、`soccer`→足球
- 一并覆盖账号中常见的邻近类型（如 indoor_cycling、strength_training 等），未知类型回落为可读标签（下划线转空格），不得原样甩出 slug 噪音

### R2 — 横向滚动 + 边界渐变
- 活动列表单行横向滚动
- 仅当内容溢出可滚动时，在对应边界显示渐变遮罩；不可滚动时不显示

### R3 — 卡片信息与图标
- 上下分栏：上栏视觉封面，下栏标题 + 指标
- 标题：活动中文名
- 指标行（小 icon）：时间 · 地点（可选）· 距离（可选）· 消耗（可选，有则显示）· 耗时
- 图标风格克制（lucide 线性图标），对齐 Landing 静气质

### R4 — 上栏视觉
- **有 route**：展示现有 GPS 路线 SVG（含起终点标记）
- **无 route**（含足球、椭圆机等）：按活动类型渲染静态 SVG 封面，替代「室内 / 无 GPS」纯文字

### R5 — 数据契约扩展
- Snapshot / 公开 API 增加：
  - `calories: number | null`
  - `locationName: string | null`（粗粒度地点字符串，经长度与格式校验）
- 地点只接受 Garmin 列表中的安全字符串字段（优先 `locationName`）；拒绝坐标样字符串；最大长度受限

### R6 — 设计气质
- 对齐 Landing / Apple 克制语言；Persuade 区块内的次级证据，非 Operate 后台

## Out of Scope

- 真实足球场地热力矩阵拉取与存储
- 活动详情页、地图控件、路线动画
- 改变隐私 fail-closed、同步频率或认证流程
- 伪造消耗 / 地点数据

## Acceptance Criteria

- [ ] AC1：椭圆机 / 操场跑步 / 足球在 Landing 显示正确中文名（同步后）
- [ ] AC2：活动为横向可滚动列表；溢出时可滑，且仅溢出时显示边界渐变
- [ ] AC3：卡片上下分栏；指标带小 icon；地点/距离/消耗无数据时不显示对应项
- [ ] AC4：有 route 的跑步上栏为 GPS 轨迹；无 route（含足球）为类型化静态 SVG 封面
- [ ] AC5：`GET /garmin/stats` 可返回 `calories` 与 `locationName`，且永不包含原始 lat/lon / sourceActivityId
- [ ] AC6：worker normalize 单测覆盖新字段与中文标签；frontend utils / backend service 既有测试同步更新并通过
