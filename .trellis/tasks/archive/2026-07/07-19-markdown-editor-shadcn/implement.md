# Implement: MarkdownEditor shadcn 改造

## Checklist

1. [x] 在 `packages/frontend` 添加 shadcn `textarea` 组件
2. [x] 重写 `MarkdownEditor.vue`：Tabs 外侧 + Textarea/预览同框 + `aria-invalid`
3. [x] 更新 `types.ts`：移除校验 props，补充 `ariaInvalid`
4. [x] 更新 `PostEdit.vue` / `PageEdit.vue` 调用方式
5. [x] 自测：编辑/预览切换、空内容、错误态边框、两页均可用

## Validation

```bash
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run lint
```

手动：打开文章编辑页、页面编辑页，切换编辑/预览，触发保存错误看 invalid 边框。

## Risky files

- `packages/frontend/src/components/ui/markdown-editor/MarkdownEditor.vue`
- `packages/frontend/src/pages/user/PostEdit/PostEdit.vue`
- `packages/frontend/src/pages/user/PageEdit/PageEdit.vue`

## Rollback

还原上述文件 + 删除新增的 `components/ui/textarea/` 即可。
