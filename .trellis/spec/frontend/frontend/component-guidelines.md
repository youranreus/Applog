# Component Guidelines

> How components are built in this project.

---

## Overview

Frontend UI primitives live under `packages/frontend/src/components/ui/` (shadcn-vue / Reka UI). Theme tokens and semantic CSS variables are defined in `packages/frontend/src/assets/base.css`, aligned with root `DESIGN.md` (Apple light theme) for interactive chrome.

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

## Button / Badge / Input (Apple theme)

- Button: `rounded-full`, `shadow-none`; `outline` / `link` use Link Blue (`#0066cc` / `text-link-blue`), not Apple Blue text
- Badge (Tag): `rounded-full`
- Input: `rounded-[8px]`, `bg-frost`, outer `focus-visible:ring-2`

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
