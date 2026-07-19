# Design: MarkdownEditor shadcn 改造

## Architecture

```
MarkdownEditor
├── Tabs (v-model: activeTab = edit | preview)
│   ├── TabsList / TabsTrigger ×2   ← 在内容框外侧上方
│   └── 共享内容框架（固定高度 + border，响应 aria-invalid）
│       ├── edit: Textarea (v-model)
│       └── preview: ArticleRenderer | 空态文案
└── （无内部 validation message）
```

## Props / API

| Prop | 类型 | 说明 |
|------|------|------|
| `modelValue` | `string` | v-model 内容 |
| `placeholder` | `string` | Textarea 占位 |
| `ariaInvalid` / `aria-invalid` | `boolean \| 'true' \| 'false'` | 错误态，透传至外框与 Textarea |

移除：`validationStatus`、`validationMessage`。

事件保持：`update:modelValue`、`focus`、`blur`。

## Layout

1. `Tabs` 根节点 `flex flex-col gap-2`
2. `TabsList` 在上（外侧）
3. 下方单一内容容器：`h-[550px]` + shadcn 边框样式（对齐 Input/Textarea 的 `border-input` / `aria-invalid:*`）
4. 编辑：`Textarea` 铺满容器（去掉 Textarea 自身双重边框，或让容器边框由 Textarea 承担——优先让 **Textarea 自身提供边框**，预览区用相同 class 的包装 div 模拟同一外框）
5. 预览：同高度滚动容器，内边距与 Textarea 接近；内容用 `ArticleRenderer`

推荐实现细节（避免双框）：

- **方案 A（推荐）**：编辑态直接用带边框的 `Textarea`（`class="h-[550px] resize-none font-mono"`）；预览态用同尺寸 `div`，`class` 复制 Textarea 的边框/圆角/padding/invalid 态
- Tabs 只负责切换，不把 Tab 放进带边框盒子里

## Call sites

```vue
<MarkdownEditor
  v-model="formData.content"
  placeholder="..."
  :aria-invalid="!!saveError"
/>
```

错误文案继续由页面侧 `FieldError` 负责。

## Compatibility

- BREAKING（组件内）：删除 `validationStatus` / `validationMessage`；仅两处调用方，同步改即可
- 预览渲染链路不变

## Trade-offs

- 固定 550px：切换不跳动；不做可拖拽高度（Out of Scope）
- 预览容器手动对齐 Textarea 视觉 token，而非强制把 ArticleRenderer 塞进 Textarea
