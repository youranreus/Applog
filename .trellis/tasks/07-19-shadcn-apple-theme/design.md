# Design: shadcn-vue Apple 主题定制

## Architecture

两层落地，互不替代：

1. **Token 层（`base.css`）** — 声明 DESIGN 色板 + 重映射 shadcn `:root` 语义变量（仅 light）
2. **组件层（目标 UI）** — 圆角/尺寸/outline 蓝等无法仅靠单一 `--radius` 表达的差异，在 CVA / class 中覆盖

```
DESIGN.md
   ↓
base.css  --color-* tokens + :root --primary/--ring/...
   ↓
shadcn components (bg-primary, border-input, ring-ring, ...)
   ↓
component CVA overrides (radius-full vs 8px, outline link-blue)
```

## Token Mapping (`:root`)

| Shadcn token | DESIGN value | Notes |
|--------------|--------------|-------|
| `--primary` | `#0071e3` | 填色按钮 / 选中态 |
| `--primary-foreground` | `#f4f8fb` | Ice |
| `--ring` | `#0071e3` | focus |
| `--foreground` | `#1d1d1f` | Carbon |
| `--muted-foreground` | `#707070` | Ash |
| `--muted` | `#e2e2e5` | Pebble |
| `--secondary` | `#e2e2e5` | Pebble |
| `--secondary-foreground` | `#1d1d1f` | Carbon |
| `--accent` | `#f4f8fb` | Ice（轻抬升，非页面 canvas） |
| `--accent-foreground` | `#1d1d1f` | Carbon |
| `--border` | `#d2d2d7` | hairline |
| `--input` | `#d2d2d7` | 输入边框 |
| `--background` | **unchanged** | 保持近白 |
| `--card` / `--popover` | **unchanged** | 保持近白 |
| `.dark *` | **unchanged** | 整块不改 |

另声明命名 token（如 `--color-apple-blue`、`--color-link-blue`、`--radius-buttons: 980px`、`--radius-inputs: 8px`）便于组件引用 outline 等特例。

## Typography

```css
--font-sans: 'SF Pro Text', 'SF Pro Display', Inter, ui-sans-serif, system-ui,
  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC",
  "Microsoft YaHei", sans-serif;
--font-heading: 'SF Pro Display', var(--font-sans);
```

- 移除 Geist Google Fonts import
- 不强制下载 SF Pro（系统已有则用，否则走回退栈）
- body 继续 `font-sans`

## Component Overrides

| Component | Key overrides |
|-----------|---------------|
| Button | `rounded-full`；去掉 shadow；`outline` → border/text `#0066cc`；default 依赖 `bg-primary` |
| Input | `rounded-[8px]`；`bg-[#f5f5f7]` 或 token；focus `ring-2` |
| Badge | `rounded-full` |
| Checkbox | 安装后 checked = primary |
| SelectTrigger | 对齐 Input 圆角/底/边框 |
| TabsTrigger | active 用 primary 语义；去掉 `shadow-sm` |

## Compatibility

- Pagination / Dialog 等非目标组件会因 `--primary` 等间接变色 —— **接受**，不做专项重设计
- 用户端 `PostDetail` Badge、管理端表单控件会同步换肤 —— **预期内**
- Landing / Header / Footer 文件不改

## Risks

- 全局 `--foreground` 变化可能轻微影响依赖 `text-foreground` 的非目标组件文案色 —— 可接受且贴近 Carbon
- outline Button 特例依赖组件 CVA，不能只靠 `--primary`

## Rollback

还原 `base.css` 与目标组件 diff；删除新建 `checkbox` 目录即可回退。
