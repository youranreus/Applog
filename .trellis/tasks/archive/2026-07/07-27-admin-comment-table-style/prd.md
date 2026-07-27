# 调整后台评论管理表格样式

## Goal

让后台「评论管理」表格在视觉与信息密度上与「文章管理」「页面管理」表格一致，并理顺列结构（时间独立前置、目标列只保留目标），降低审核时的扫视成本。

## Background

- 评论表格：`packages/frontend/src/pages/user/CommentList/components/CommentTable.vue`
- 对照基准：`PostTable.vue` / `PageTable.vue`（`admin-content-table`：pebble 边框、frost 表头、`radius-cards`、灰阶文字、状态圆点）
- 现状：评论表用独立 `table-wrap`、圆角更大、`Badge` 状态、评论列内嵌时间、目标列附带父评论 ID 与后代条数
- 评论行交互不同：Popover 操作（通过/拒绝/删除），非整行点击编辑；本次不改为行点击导航
- 空态/错误态已在 `CommentList.vue` 处理；表格组件内暂无内嵌 loading/empty

## Requirements

1. **视觉对齐**：评论管理表格容器、表头、单元格间距、边框与圆角对齐 `admin-content-table` 风格（与 Post/Page 管理表一致）。
2. **列：时间独立前置**：将 `createdAt` 从「评论」列内嵌抽出，新增独立「时间」列置于表头最左；格式为**仅日期**（`toLocaleDateString('zh-CN', { year, month: '2-digit', day: '2-digit' })`，与文章/页面一致）。
3. **列：目标只展示目标**：原「目标 / 父级」改为「目标」；仅展示目标文章/页面标题链接（或无标题时 `#id`）；不展示父评论 ID、不展示后代条数。
4. **状态展示**：审核状态改为文字 + 状态圆点（对齐内容管理表），替代 `Badge`；待审核 / 已通过 / 已拒绝需可区分。
5. **保留**：评论内容、评论者（含站点链接）、邮箱、IP、操作 Popover 及禁用逻辑；不改 API / 筛选 / 分页 / 删除弹窗中的后代影响说明。

## Out of Scope

- 后端 API、筛选、分页、迁移弹窗
- 评论行整行点击导航
- 抽取共享 `AdminContentTable` 组件（本任务内复用视觉 CSS 约定即可）
- 暗色主题专项改造

## Acceptance Criteria

- [ ] 评论管理表格视觉（边框、表头底色、字号/字重、圆角、行分隔）与文章/页面管理表属同一设计语言
- [ ] 表头以「时间」列开头；评论列内不再嵌套时间；时间显示为仅日期
- [ ] 「目标」列仅显示目标标题（或 `#id`），无父评论、无后代条数文案
- [ ] 状态列使用圆点样式，不再使用 `Badge`
- [ ] 通过 / 拒绝 / 删除操作行为与改前一致
- [ ] 改动范围内前端 type-check / lint 通过

## Key Decisions

- 时间列精度：**仅日期**（与文章/页面 meta 列一致）
- 目标列：去掉父级与后代数展示；后代数仍仅在删除弹窗中出现
- 不做跨表组件抽取；视觉对齐为主

## Technical Notes

- 主要改动面：`CommentTable.vue`
- 状态圆点需为 `pending` / `approved` / `rejected` 定义区分色（可参考 published/draft 圆点模式）

## Notes

- 轻量任务：PRD-only，无需 `design.md` / `implement.md`
