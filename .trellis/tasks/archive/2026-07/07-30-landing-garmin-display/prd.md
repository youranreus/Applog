# 调整 Landing Garmin 展示

## Goal

让 Landing 的 Garmin 最近运动列表按照“是否存在 GPS 路线”呈现两种清晰形态：有路线的活动保留路线视觉与详情弹窗，无路线的活动直接在卡片内提供有用数据且不可打开；同时修复详情弹窗在常见视口中内容横向溢出的问题，并完整支持室外骑行与室内骑行。

## Background

- 当前所有活动统一渲染 `GarminActivityCover`；当既没有服务端封面也没有有效路线时，会回退到运动类型插画，而不是数据面板（`packages/frontend/src/pages/Landing/components/LandingGarminStats/GarminActivityCover.vue`）。
- 当前卡片对所有具有 `publicId` 的活动开放详情；公开活动契约中的 `publicId` 为必填字符串，因此“无路线不可点击”不能沿用现有 `publicId` 判定，必须显式按有效 GPS 路线区分（`packages/common/src/types/garmin.ts`、`GarminActivityCard.vue`）。
- 卡片当前绑定 `usePointerTilt`，其动态 transform 同时包含最大 ±4° 的倾斜和 `scale(1.025)` 放大；本次只移除 scale，保留倾斜（`hooks/usePointerTilt.ts`）。
- 详情弹窗声明宽度 `min(62rem, 100vw - 2rem)`，但内部双栏最小宽度合计至少 37rem，并且只在 720px 以下切为单栏；这会使 721px 至约 624px 之外的部分中间视口或受 Dialog 基础样式约束时出现内容溢出（`GarminActivityDetailDialog.vue`）。
- Worker 已识别 `cycling`、`mountain_biking`、`gravel_cycling` 为路线活动，类型本地化已包含 `cycling` → “骑行”和 `indoor_cycling` → “室内骑行”；但详情重解析白名单当前不含 `indoor_cycling`，前端指标预设也只有 `cycling`，没有独立的 `indoor_cycling` 预设（`workers/garmin-sync/src/garmin_sync/sync.py`、`normalize.py`、`repository.py`、前端 `utils.ts`）。
- Landing 摘要接口当前直接提供日期、距离、时长、热量、地点、路线和封面；平均心率、功率、踏频、训练效果等属于懒加载详情接口，现有列表卡片不能直接使用这些字段（`packages/common/src/types/garmin.ts`）。
- 用户已决定扩展 Landing 公开摘要，使无路线卡片可直接展示按运动类型选择的 3–5 个核心指标，而不是停留在现有摘要字段。

## Requirements

### R1. 卡片 hover 交互

- Garmin 活动卡片在支持 hover 的精细指针设备上继续随指针产生有界倾斜，但不再发生尺寸放大。
- 触摸设备和 `prefers-reduced-motion` 环境继续禁用倾斜；指针离开、失焦或页面滚动后恢复静止姿态。
- 可交互卡片仍保留清晰的键盘焦点反馈。

### R2. 按有效 GPS 路线区分卡片

- 仅具有可解析路线的活动展示地图/路线封面并允许打开详情。
- 没有可解析 GPS 路线的活动不展示地图、运动类型插画或其他封面，改为卡内数据布局。
- 无路线数据布局在标题与日期之外最多展示 5 项非空指标，空值直接省略；按类型优先级选择：
  - `indoor_cycling`：时长、热量、平均心率、平均功率、踏频；
  - `treadmill_running`：距离、时长、平均配速、平均心率、踏频；
  - `elliptical`：时长、热量、平均心率、踏频、训练效果；
  - `indoor_cardio`：时长、热量、平均心率、最高心率、训练效果；
  - `stair_climbing`：时长、热量、平均心率、踏频、步数；
  - 其他无路线类型：时长、热量、平均心率、最高心率，按可用值降级。
- 无路线活动使用非交互语义，不响应鼠标、触摸或键盘激活，也不暴露“查看详情”的可访问名称。
- 路线判定以安全解析后的 `activity.route` 为准，而不是仅检查封面、活动类型或 `publicId`。

### R3. 详情弹窗响应式视觉修复

- 有路线活动的详情弹窗在桌面、平板和手机常见视口中均不产生横向溢出。
- 弹窗内容、指标和分段信息保持可读，关闭按钮保持可见可用。
- 实现后进行实际页面视觉校验，覆盖双栏与单栏断点边界，而不只依赖单元测试。

### R4. 骑行类型支持

- `cycling`（骑行）作为有路线活动展示路线封面并允许打开详情。
- `indoor_cycling`（室内骑行）作为无路线活动展示卡内数据且不可打开。
- 室内骑行使用适合骑行的指标定义，不错误展示跑步配速或步频文案。
- Landing 摘要只新增已白名单化、有限数值指标，不公开 splits、原始 payload、坐标或任何 Garmin 身份信息。

## Acceptance Criteria

- [x] AC1：使用支持 hover 的鼠标在 Garmin 卡片内移动时，卡片保留当前有界倾斜，但边界尺寸不放大；离开、失焦或滚动后倾斜复位。
- [x] AC1a：触摸设备或启用减少动态效果时，卡片不产生倾斜或缩放。
- [x] AC2：具有有效路线的跑步或骑行卡片显示路线视觉，鼠标点击与键盘激活均可打开详情。
- [x] AC3：无有效路线的跑步机、椭圆机、室内有氧或室内骑行卡片完全不显示封面区域，直接显示已约定的详细指标。
- [x] AC4：无有效路线的活动不是按钮，不可点击、不可通过 Enter/Space 打开详情，也没有误导性的详情 aria-label。
- [x] AC5：`cycling` 和 `indoor_cycling` 分别显示“骑行”和“室内骑行”，并遵循有路线/无路线两种卡片行为。
- [x] AC6：详情弹窗在至少 1440×900、1024×768、768×1024、390×844 视口完成视觉校验，无横向内容溢出、遮挡或不可达内容。
- [x] AC7：自动化测试覆盖路线判定、两类卡片交互语义、骑行指标预设和关键响应式约束；现有 Garmin 格式化测试继续通过。
- [x] AC8：无路线卡片最多显示 5 项非空指标；缺失指标被省略，且不会出现 `null`、`undefined` 或“暂无”占位。
- [x] AC9：公开 Landing JSON 新增指标均来自已归一化的 `detailData` 白名单，响应中仍不包含原始坐标、`sourceActivityId`、splits 或私有 payload。

## Out of Scope

- 改变 Garmin 隐私过滤、安全路线抽象或公开原始坐标。
- 为无路线活动生成虚构路线、地图或装饰性运动封面。
- 改变 Landing 展示的活动数量、排序或 Garmin 同步频率。
- 重做整个 Landing 或非 Garmin 区域的视觉系统。
- 让无路线卡片重新开放详情弹窗。
