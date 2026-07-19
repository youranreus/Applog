# Implement: shadcn-vue Apple 主题定制

## Checklist

1. [x] 安装 Checkbox：`pnpm --filter @applog/frontend dlx shadcn-vue@latest add checkbox`（或等价命令）
2. [x] 更新 `packages/frontend/src/assets/base.css`
   - 移除 Geist import
   - 添加 DESIGN 命名 token
   - 重映射 `:root` 交互语义变量（不改 background/card/popover，不改 `.dark`）
   - 更新 `--font-sans` / `--font-heading`
3. [x] 调整 `button/index.ts`：pill 圆角、outline Link Blue、去阴影
4. [x] 调整 `input/Input.vue`：8px、Frost 底、focus
5. [x] 调整 `badge/index.ts`：pill 圆角
6. [x] 调整 Checkbox 安装产物：对齐 primary 选中态
7. [x] 调整 `select/SelectTrigger.vue`（必要时 Content）：对齐 Input
8. [x] 调整 `tabs/TabsTrigger.vue`（必要时 TabsList）：选中态 / 去阴影
9. [x] 确认 Landing / Header / Footer 无 diff
10. [x] 运行 type-check + lint

## Validation

```bash
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run lint
```

目视：管理端含 Input/Button/Select/Tabs 的页面；文章详情 Badge；可选 Checkbox 冒烟。

## Risky files

- `packages/frontend/src/assets/base.css` — 全局影响面最大
- `packages/frontend/src/components/ui/button/index.ts` — 影响所有 Button 消费者（含 Pagination）

## Rollback

`git checkout` 上述文件；删除 `components/ui/checkbox`。

## Before `task.py start`

- [x] prd.md 已收敛
- [x] design.md / implement.md 已写
- [ ] 用户审阅通过
