# Markdown 编辑器改用 shadcn 组件

## Goal

将文章/页面编辑页的 Markdown 编辑器改为 shadcn 风格：编辑/预览切换放在输入框外侧，正文输入与预览区共用同一外框，校验态与其它表单字段对齐。

## Background

- `PostEdit.vue` 与 `PageEdit.vue` 共用 `MarkdownEditor`
- 当前：自定义 Tab 在带边框容器**内部**；正文为原生 `<textarea>`；预览用 `ArticleRenderer`
- 项目已有 shadcn `Tabs`（Dashboard 在用）；尚无 `Textarea`，需 CLI 添加
- 其它字段已用 `Input`/`Select` + `aria-invalid`；页面底部已有 `FieldError` 展示 `saveError`
- `MarkdownEditor` 自有 `validationStatus` / `validationMessage` 与页面级错误提示重复

## Requirements

- R1: 编辑/预览切换移到内容区**外侧上方**，使用 shadcn `Tabs`
- R2: 正文编辑区改用 shadcn `Textarea`（先添加组件）
- R3: 预览与 Textarea **共用同一套边框与固定高度框架**；切换时外框不动
- R4: 预览内容仍由 `ArticleRenderer` 渲染
- R5: 对外校验改为 `aria-invalid`；移除 `validationStatus` / `validationMessage`
- R6: `PostEdit` / `PageEdit` 改为传 `:aria-invalid="!!saveError"`，去掉旧校验 props

## Acceptance Criteria

- [x] AC1: 编辑/预览切换在输入框外侧，使用 shadcn Tabs（对应 R1）
- [x] AC2: 正文为 shadcn Textarea，风格与其它 Input 一致（对应 R2）
- [x] AC3: 编辑与预览共用同一边框/高度框架，切换不跳动（对应 R3）
- [x] AC4: 有内容时预览正常渲染；空内容显示占位提示（对应 R4）
- [x] AC5: 文章/页面编辑页均生效（共用组件）（对应 R1–R6）
- [x] AC6: 错误时 Textarea/预览外框呈 invalid 态；错误文案仅由页面 `FieldError` 展示，组件内无重复提示（对应 R5–R6）

## Decisions

- D1: 预览与 Textarea 共用同一边框/固定高度框架
- D2: 校验迁移到 `aria-invalid`，移除组件内校验文案与 `validationStatus` API

## Out of Scope

- 不引入富文本 / CodeMirror 等更重编辑器
- 不改前台详情页渲染与 Markdown/BBCode 插件
- 不改保存/校验业务逻辑，仅改展示层

## Technical Notes

- 改动中心：`packages/frontend/src/components/ui/markdown-editor/`
- 新增：`pnpm dlx shadcn-vue@latest add textarea`（在 `packages/frontend`）
- 调用方：`PostEdit.vue`、`PageEdit.vue`
- Tabs 用法可参考 `Dashboard.vue`
