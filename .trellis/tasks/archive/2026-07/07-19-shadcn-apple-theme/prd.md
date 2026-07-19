# PRD: shadcn-vue Apple 主题定制

## Goal

将前端已使用的 shadcn-vue 基础控件按根目录 `DESIGN.md`（Apple Style Reference）做自定义主题，使 Input / Button / Tag(Badge) / Checkbox / Select / Tabs 以及全局字体符合该设计语言，同时不改动用户端页面布局与其他非目标内容。

## Background

- 设计规范来源：仓库根目录 `DESIGN.md`（light theme，近白画布 + 单一蓝强调色 `#0071e3`）
- 当前主题入口：`packages/frontend/src/assets/base.css`（Geist 字体 + neutral oklch 语义色）
- 组件库：shadcn-vue（reka-nova），UI 位于 `packages/frontend/src/components/ui/`
- 仓库内无暗色主题切换入口；`.dark` 变量块存在但未启用

## Confirmed Decisions

| 决策 | 结论 |
|------|------|
| Tag | 对应现有 `Badge` |
| Checkbox | 安装并初始化 shadcn-vue checkbox，再主题化 |
| 主题落地 | **全局重映射** `:root` 交互语义 CSS 变量 |
| 页面 surface | **不改** `--background` / `--card` / `--popover`（保持近白） |
| Dark mode | **不改** `.dark` |
| 用户端其他内容 | 不改 Landing / Header / Footer 等页面布局与非目标组件专项样式 |

## Requirements

1. **全局字体**：在 `base.css` 将 `--font-sans` / `--font-heading` 改为 SF Pro Text / Display 栈（回退 Inter / system-ui / -apple-system），移除 Geist 主字体依赖
2. **DESIGN token**：在 `base.css` 声明 DESIGN.md 色板与圆角等 CSS 变量，供语义映射与组件引用
3. **全局语义色（仅 `:root`）**：映射交互相关 token，至少包括：
   - `--primary` → Apple Blue `#0071e3`
   - `--primary-foreground` → Ice `#f4f8fb`
   - `--ring` → Apple Blue `#0071e3`
   - `--foreground` → Carbon `#1d1d1f`
   - `--border` / `--input` → 浅灰边框（如 `#d2d2d7`）
   - `--muted` / `--muted-foreground` → Pebble / Ash 语义
   - `--secondary` / `--accent` → 浅灰表面语义（非页面 canvas）
   - **禁止**将 `--background` / `--card` / `--popover` 改为 Frost
4. **Button**：组件级 `rounded-full`（980px）；default 吃 primary；outline 使用 Link Blue `#0066cc` 描边与文字；去掉阴影类
5. **Input**：`rounded-lg`（8px）；背景 Frost；边框与 focus 对齐 token
6. **Badge（Tag）**：`rounded-full`（980px）
7. **Checkbox**：`pnpm dlx shadcn-vue@latest add checkbox` 安装后，选中态对齐 primary
8. **Select**：Trigger 与 Input 对齐（8px、同类边框/底/focus）
9. **Tabs**：选中态对齐 primary / Apple Blue；去掉多余阴影装饰

## Acceptance Criteria

- [x] `components/ui/checkbox` 已安装并可导出使用
- [x] 全局主字体为 SF Pro 栈，不再以 Geist 为主字体
- [x] `:root` 交互语义变量已映射 DESIGN.md；`--background` / `--card` / `--popover` 仍为近白；`.dark` 未改
- [x] Button / Input / Badge / Checkbox / Select / Tabs 满足 DESIGN.md 圆角、主色、focus、无按钮阴影要求
- [x] Landing / Header / Footer 等用户端布局文件无非必要 diff
- [x] `pnpm --filter @applog/frontend run type-check` 与 lint 无新增失败

## Out of Scope

- 整站 canvas 改为 Frost
- 重建 `.dark` 主题
- Card / Dialog / Pagination / Sonner 等专项重设计（允许因全局 token 间接变色）
- Landing / Header / Footer 内容与布局调整
