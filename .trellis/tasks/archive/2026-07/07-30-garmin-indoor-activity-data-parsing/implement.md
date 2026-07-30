# Garmin 室内运动详情解析实施计划

## Phase 1: Fixture and parser tests

- [x] 用脱敏合成值建立跑步机、室内有氧、椭圆机和爬楼机的 `summaryDTO` fixture。
- [x] 先补失败测试，覆盖嵌套优先级、顶层兼容、明确零值、非法数值与缺失字段。
- [x] 实现 summary/metadata source selection 和完整字段映射。
- [x] 实现 `lapDTOs` → typed splits → split summaries 的单源优先级与 12 段上限。

## Phase 2: Persistence and API

- [x] 扩展 Python model 与 repository upsert。
- [x] 增加 nullable 数据库列和 TypeORM entity 字段。
- [x] 扩展 snapshot allowlist、公共类型和 NestJS DTO 映射。
- [x] 增加无氧训练效果、训练负荷和步数的后端隐私/兼容测试。

## Phase 3: Frontend presentation

- [x] 在指标注册表加入三个新指标及格式化规则。
- [x] 为跑步机配置合理优先级，其他类型仅展示有值指标。
- [x] 测试 null 隐藏、零值保留与不同运动类型的指标选择。

## Phase 4: Bounded reparse/refetch

- [x] 实现无需 Garmin 请求的本地加密载荷重解析路径。
- [x] 将 `InvalidTag` 活动安全加入有界详情重抓队列。
- [x] 保持批次预算、部分成功、幂等覆盖和非敏感错误分类。
- [x] 先 dry-run 汇总候选及字段提升，再执行当前室内活动批次。
- [x] 验证可解密详情不再全空，并确认旧椭圆机载荷已重抓或明确留在可重试状态。

## Quality gates

- [x] Garmin worker Ruff 与完整 pytest。
- [x] Backend lint/type-check 与相关测试。
- [x] Common/frontend type-check、专项 lint 与相关测试（全量 lint 仅被任务外既有 `CalendarHeading.vue` explicit-any 阻塞）。
- [x] 数据库迁移 up/down 或项目既有等价门禁。
- [x] 只读回填后聚合报告，不输出任何私人值。
- [x] `git diff --check` 和 Trellis task validation。

## Risk and rollback points

- Schema shape 和字段语义先由测试锁定，再改持久化与公开契约。
- 本地重解析与远程重抓分开开关；前者不消耗 Garmin 请求预算。
- 不可解密载荷必须远程重抓，不能以跳过认证或直接改状态解决。
- 前端新增指标必须在 nullable 数据到达前即可安全部署。
