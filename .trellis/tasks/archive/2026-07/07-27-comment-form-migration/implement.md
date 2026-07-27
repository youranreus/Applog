# 实施计划

## 1. 评论编辑器与表单布局

- [x] 新增页面局部 `CommentEditor.vue`，实现 typed `v-model`、shadcn 同款状态与内嵌提交按钮。
- [x] 调整 `CommentForm.vue`：游客身份字段上移、正文改用新组件、删除独立提交按钮。
- [x] 校验桌面三列、移动端单列，以及文本不被按钮遮挡。

## 2. 评论迁移 API 与状态协调

- [x] 增加前端迁移请求/响应类型与 `/config/migrate` API 封装。
- [x] 抽取纯请求构造函数并固定 `source='typecho'`、`resources=['comments']`，不暴露 `clearExisting`。
- [x] 新增 `useCommentMigration.ts`，管理打开、请求、结果、错误、通知与成功刷新。

## 3. 后台入口与弹窗

- [x] 为 `AdminListHeader.vue` 增加兼容默认行为的 `before-action` slot。
- [x] 新增 `CommentMigrationDialog.vue`，包含连接字段、进行中状态、错误和结果统计。
- [x] 在 `CommentList.vue` 中把迁移按钮放到刷新旁边，连接 hook 与列表刷新。

## 4. 测试与质量验证

- [x] 新增前端确定性测试：迁移 payload 永远为 comments-only 且不含 `clearExisting`；验证评论表单结构和页头入口。
- [x] 运行 `pnpm --filter @applog/frontend run test:unit`。
- [x] 对本次涉及文件运行 ESLint 与 Oxlint；全量 lint 仍被 14 个任务外历史错误阻断。
- [x] 运行 `pnpm --filter @applog/frontend run type-check`。
- [x] 运行 `pnpm --filter @applog/frontend run build`。
- [x] 运行 `pnpm --filter @applog/backend run test:unit`，确认既有 comments-only 合约。
- [x] 运行 `pnpm --filter @applog/backend run build` 与根 `pnpm run build`。
- [x] 运行 `git diff --check` 并进行代码审查。

## 5. 风险文件与检查点

- `packages/frontend/src/pages/user/components/AdminListHeader.vue`：共享组件，必须验证文章/页面管理默认按钮未变化。
- `packages/frontend/src/pages/post/components/comments/CommentForm.vue`：保持原提交 payload 与游客必填校验。
- 迁移 API payload：任何资源可配置或 `clearExisting` 泄漏都视为阻断缺陷。
