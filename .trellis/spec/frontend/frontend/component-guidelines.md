# Component Guidelines

> How Vue components are built in `@applog/frontend`.

---

## Overview

All SFCs use `<script setup lang="ts">` (no Options API). Frontend UI primitives live under `packages/frontend/src/components/ui/` (shadcn-vue / Reka UI). Theme tokens and semantic CSS variables are defined in `packages/frontend/src/assets/base.css`, aligned with root `DESIGN.md` (Apple light theme) for interactive chrome.

---

## SFC Conventions

1. Prefer Composition API only.
2. Keep page SFCs thin — call a page hook or store.
3. Import shadcn pieces from `@/components/ui/<name>` barrels.
4. Merge classes with `cn()` from `@/lib/utils`.
5. Icons: existing layout code may still use ionicons; new shadcn-adjacent UI typically uses lucide (`@lucide/vue`).

Example imports (admin settings):

```typescript
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
```

Reference: `packages/frontend/src/pages/user/Dashboard/components/SystemSettings.vue`, `packages/frontend/components.json`.

---

## Component Layers

| Layer | Path | Examples |
|-------|------|----------|
| shadcn primitive | `components/ui/button`, `dialog`, `field`, … | `Button.vue` |
| Reusable business UI | also under `components/ui/` | `markdown-renderer`, `photos`, `article-card` |
| Layout | `components/Layout/` | `Header.vue`, `Footer.vue` |
| Page-local | `pages/**/components/` | `PostTable.vue`, `AdminPagination.vue` |

### Dashboard traffic (admin)

- **PersonalStats**: append today / last-7d Views·Visitors as quiet stat rows (same list tone as post/page/comment counts) — not rainbow metric cards.
- **TrafficStats** tab (admin-only): ~30-day **SVG** trend (no chart.js/echarts) + single path Top 10 + OS / device / country breakdown.
- Gate traffic summary + tab with admin role; non-admins must not see either.
- Do not imply Dashboard traffic equals public `viewCount`.
- Empty/error when Umami未配置：引导至系统设置「流量分析 / Umami」。

Reference: `pages/user/Dashboard/Dashboard.vue`, `PersonalStats.vue`, `TrafficStats.vue`, `SystemSettings.vue`.

---

## Theming (shadcn + DESIGN.md)

### Convention: Token mapping scope

**What**: Remap `:root` interactive semantic tokens (`--primary`, `--ring`, `--foreground`, `--border`, `--input`, `--muted`, …). Keep `--background` / `--card` / `--popover` near-white. Do not rewrite `.dark` unless explicitly tasked.

**Why**: Global token remapping keeps Button/Input/Select consistent without restyling every page canvas.

**Example**:
```css
:root {
  --primary: #0071e3;
  --ring: #0071e3;
  --background: oklch(1 0 0); /* keep near-white — do not use Frost here */
}
```

### Convention: Permanent edge vs focus glow

| Use case | Prefer | Notes |
|----------|--------|-------|
| Permanent chrome (Card outline) | real `border` | Survives parent `overflow` |
| Ephemeral focus | outer `ring` / `box-shadow` | Needs gutter if ancestor scrolls |

> **Warning**: Tailwind `ring-*` is `box-shadow`. `overflow-y: auto` computes `overflow-x` to `auto` and **clips** flush children's side rings. Do not put `padding` on the flex column that must stay edge-aligned — put scroll + `2px` gutter on an **inner** wrapper instead.

**Wrong** (clips ring / or breaks column alignment):
```css
.edit-main { overflow-y: auto; padding: 2px; } /* padding on aligned column */
```

**Correct**:
```html
<div class="edit-main"> <!-- overflow:hidden; no padding; outer edges align -->
  <div class="edit-pane-scroll"> <!-- overflow-y:auto; padding:2px -->
    <!-- inputs with outer focus ring -->
  </div>
</div>
```

Card permanent edge:
```ts
// Prefer border over ring-1 for Card chrome
'border border-border ...'
```

---

## Select

### Convention: Popper positioning

**What**: `SelectContent` defaults to `position: 'popper'` (dropdown below trigger).

**Why**: `item-aligned` mimics native `<select>` alignment and looks like a system control.

```vue
<!-- Default is popper. Only pass item-aligned when native-like alignment is intentional. -->
<SelectContent>
  <SelectItem value="draft">草稿</SelectItem>
</SelectContent>
```

### Convention: Cursor

`SelectTrigger` and `SelectItem` use `cursor-pointer` (disabled trigger stays `cursor-not-allowed`).

---

## Tabs

### Convention: Active hover must keep active text color

**What**: Default horizontal Tabs use `data-active:bg-primary` + `data-active:text-primary-foreground`. Always pair with `data-active:hover:text-primary-foreground` (line variant: `data-active:hover:text-primary`).

**Why**: Bare `hover:text-foreground` overrides active white/blue text and turns the selected tab illegible on hover.

**Also**:
- Triggers use `cursor-pointer` (disabled → `cursor-not-allowed`)
- Default list height is `h-10` with comfortable trigger padding (`px-3 py-1.5`)

---

## Textarea / MarkdownEditor

### Convention: Textarea matches Input chrome

**What**: `Textarea` uses the same Apple chrome as `Input`: `rounded-[8px]`, `bg-frost`, `focus-visible:ring-2`.

**Why**: Edit forms mix Input + Textarea; mismatched radius/fill looks inconsistent.

### Convention: MarkdownEditor layout

**What**: `MarkdownEditor` puts shadcn `Tabs` **outside** the content frame. Edit (`Textarea`) and preview (`ArticleRenderer`) share one fixed-height frame (`550px`) so switching does not jump. Errors use `aria-invalid` — do **not** reintroduce `validationStatus` / `validationMessage`; page-level `FieldError` owns the message.

```vue
<MarkdownEditor
  v-model="formData.content"
  placeholder="..."
  :aria-invalid="!!saveError"
/>
```

Reference: `packages/frontend/src/components/ui/markdown-editor/`.

---

## Button / Badge / Input (Apple theme)

- Button: `rounded-full`, `shadow-none`; `outline` / `link` use Link Blue (`#0066cc` / `text-link-blue`), not Apple Blue text
- Badge (Tag): `rounded-full`
- Input: `rounded-[8px]`, `bg-frost`, outer `focus-visible:ring-2`
- Textarea: same chrome as Input (see above)

---

## Styling Notes

- Prefer Tailwind utilities; scoped SCSS is OK for deep article/markdown styles (`:deep()`).
- Global design tokens: `packages/frontend/src/assets/base.css` (`@import "tailwindcss"`, `@theme inline`, `:root` / `.dark`).
- Global scrollbar (WebKit + Firefox): transparent track, 8px rounded thumb in Pebble / Ash — defined in `base.css` `@layer base`.
- Notifications: call `useLayoutStore().notify(...)`; `GlobalNotification.vue` bridges to Sonner — do not invent a second toast path.
- Toast chrome (`components/ui/sonner/Sonner.vue`): **no type icons**, `richColors: false`, light hairline card (`applog-toast`); types differ by subtle border/bg only on error. Keep close-button X; do not reintroduce colored icon circles.
- Admin overview metrics: prefer **list rows + `RouterLink`** to management routes; avoid equal-weight rainbow metric card grids (SaaS vanity pattern).

---

## Admin list surfaces

Management list pages (`/user/post`, `/user/page`) share shell pieces under `pages/user/components/`:

- `AdminListHeader` — title + wave underline (aligned with Dashboard) + one filled primary create CTA on the right
- `AdminListSearch` — leading search icon, submit on Enter only, custom clear `X` (hide native webkit cancel)
- `AdminListEmpty` / `AdminListError` — empty teaches next step; error offers retry
- `AdminPagination` — uses shadcn Pagination; active page is `ghost` + muted fill (**no outline border**)

Table conventions: clickable rows are keyboard-reachable (`tabindex` + Enter/Space); prefer compact columns (title · slug · status · updated); page lists may add「作用于」for nav/footer.

Reference: `packages/frontend/src/pages/user/PostList/`, `packages/frontend/src/pages/user/PageList/`, `packages/frontend/src/pages/user/components/AdminList*.vue`.

---

## Site settings + Footer meta

### Convention: Date fields use shadcn Calendar + Popover

**What**: Admin date inputs (e.g. 建站日期) use `Popover` + `Calendar` + trigger `Button`, not native `<input type="date">`. Persist as `YYYY-MM-DD` string on `ISystemBaseConfig`; clear sets `''`.

**Why**: Matches shadcn-vue / Apple-theme chrome; supports explicit clear UX.

**Related**: `@internationalized/date` `CalendarDate` ↔ string helpers live next to the form (`SystemSettings.vue`).

### Convention: Footer Row1 vs Row2

**What**:
- 上行（可选）：ICP + uptime — sibling block；桌面同行、移动两行
- 下行：Copyright | Nav (+ optional buildInfo) — preserve original single-row flex/`sm:contents` layout
- Never nest meta inside the copyright cell

**Why**: Nesting meta inside the copyright flex item breaks Copyright + Nav staying on one row. Meta sits above the legal/nav row.

Reference: `packages/frontend/src/components/Layout/Footer.vue`, `packages/frontend/src/utils/site-uptime.ts`, `packages/frontend/src/pages/user/Dashboard/components/SystemSettings.vue`.

---

## Markdown / BBCode UI

`MarkdownRenderer` uses IntersectionObserver lazy images. BBCode tags map to Vue components via `utils/markdown` registries (`art`, `bili`, `collapse`, `photos`, `dplayer`).

Reference: `packages/frontend/src/components/ui/markdown-renderer/`, `packages/frontend/src/utils/markdown/`.

---

## Common Mistakes

### Common Mistake: Ring clipped inside scroll panes

**Symptom**: Card sides missing; Input focus glow cut on left/right.

**Cause**: Parent `overflow-y: auto` + flush full-width child + `ring`/`box-shadow`.

**Fix**: Card → `border`; focus → inner scroll gutter (or inset ring only if product accepts it).

### Common Mistake: Padding on outer edit columns

**Symptom**: Left/right panes look vertically misaligned after “fixing” clipped rings.

**Cause**: `padding` added directly on `.edit-main` / `.edit-sidebar`.

**Fix**: Keep outer columns padding-free; gutter only on inner `.edit-pane-scroll`.

### Common Mistake: Tabs active hover turns white text dark

**Symptom**: Selected tab text becomes hard to read on hover.

**Cause**: `hover:text-foreground` without `data-active:hover:text-primary-foreground`.

**Fix**: Always pin active hover text to the active color (see Tabs convention).

### Common Mistake: Options API or Axios

Not used in this codebase — stick to `<script setup>` + Alova.
