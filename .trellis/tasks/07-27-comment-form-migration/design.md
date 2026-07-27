# 技术设计

## 1. 边界与组件图

### 公开评论表单

- `CommentForm.vue`：保留表单状态、身份字段、校验和 `submit/cancel` 事件协调。
- 新增 `CommentEditor.vue`：只负责正文 `v-model`、shadcn 一致的输入框视觉状态，以及右下角内嵌提交按钮。
  - 输入：`modelValue`、`disabled`、`placeholder`、`maxlength`、`required`。
  - 输出：`update:modelValue`；按钮使用原生表单 `type="submit"`，不复制提交逻辑。
- 游客身份字段在 `CommentForm.vue` 中移动到正文上方；桌面三列、窄屏单列。

### 后台评论迁移

- `CommentList.vue`：保持为页面组合层，连接列表 hook、页头动作和迁移弹窗。
- `AdminListHeader.vue`：增加可选 `before-action` slot，在原主操作前插入附加动作；默认主按钮契约保持不变，保证文章/页面管理兼容。
- 新增 `CommentMigrationDialog.vue`：负责 Typecho 数据库连接表单与迁移统计展示。
  - 输入：`open`、`loading`、`result`、`error`。
  - 输出：`update:open`、`submit(dbConfig)`。
- 新增 `useCommentMigration.ts`：负责弹窗状态、Alova 请求、成功/失败通知及成功回调。
- 新增 system-config migration API 与前端类型；请求构造函数固定：

```ts
{
  source: 'typecho',
  dbConfig,
  resources: ['comments']
}
```

不接收资源选择，不设置 `clearExisting`，也不发送文章字段映射。

## 2. 数据流

```text
管理员填写远程库配置
  → CommentMigrationDialog emit submit
  → useCommentMigration
  → POST /config/migrate（resources=['comments']）
  → 现有 MigrationService / TypechoAdapter
  → 仅读取 Typecho comments
  → 按已迁移文章 originalId 建立关联并幂等导入
  → 返回统计 → 弹窗展示 + 通知 + 刷新后台评论列表
```

## 3. 视觉与交互约束

- `CommentEditor` 外层承担 border、background、focus-within ring、invalid 与 disabled 状态；内部 textarea 去除自身边框和 ring。
- textarea 预留足够的右侧与底部内边距，避免文本和滚动内容被悬浮按钮遮挡。
- 发送按钮固定在编辑器右下角；禁用期间正文和按钮同步禁用。
- 迁移弹窗使用现有 shadcn `Dialog`、`Field`、`Input`、`Button`，密码字段不回显。
- 数据库端口默认 `3306`，Typecho 表前缀默认 `typecho_`；源类型固定展示为 Typecho。
- 迁移失败不关闭弹窗、不清空用户填写的连接信息；关闭后重新打开时清除上次结果与错误。

## 4. 兼容性与安全

- 后端现有 `MigrateDataDto`、管理员鉴权和 comments-only 逻辑已满足需求，不新增公开接口。
- 目标文章不存在时沿用后端既有行为：跳过评论并通过 `commentsMissingPost` 呈现，不隐式迁移文章。
- 现有 `(source, sourceId)` 唯一约束继续保证重跑幂等。
- `AdminListHeader` 的默认渲染路径不改变，避免影响文章和页面管理页。

## 5. 回滚边界

- 评论表单改动可通过移除 `CommentEditor` 并恢复原 `Textarea + Button` 布局回滚。
- 管理端迁移入口完全复用现有后端能力；回滚只需移除前端 API、hook、弹窗和页头 slot 使用，不涉及数据库结构。
