<script setup lang="ts">
import { MousePointer2 } from '@lucide/vue'
import type { IVisitorCursorResponse } from '@applog/common'
import { useVisitorCursors } from '@/hooks/visitor-cursor/useVisitorCursors'

const { cursors } = useVisitorCursors()

function getCursorStyle(cursor: IVisitorCursorResponse): Record<string, string> {
  return {
    '--visitor-cursor-x': String(cursor.x * 100),
    '--visitor-cursor-y': String(cursor.y * 100),
    '--visitor-cursor-color': cursor.color,
  }
}
</script>

<template>
  <div v-if="cursors.length" class="visitor-cursor-layer" aria-hidden="true">
    <div
      v-for="cursor in cursors"
      :key="cursor.visitorKey"
      class="visitor-cursor"
      :class="{
        'visitor-cursor--label-left': cursor.x > 0.78,
        'visitor-cursor--label-up': cursor.y > 0.9,
      }"
      :style="getCursorStyle(cursor)"
    >
      <MousePointer2 class="visitor-cursor__icon" :size="20" :stroke-width="2" />
      <span class="visitor-cursor__label">#{{ cursor.displayId }}</span>
    </div>
  </div>
</template>

<style scoped>
.visitor-cursor-layer {
  position: absolute;
  inset: 0;
  z-index: var(--z-visitor-cursor);
  overflow: hidden;
  pointer-events: none;
}

.visitor-cursor {
  position: absolute;
  top: calc(var(--visitor-cursor-y) * 1%);
  left: calc(var(--visitor-cursor-x) * 1%);
  width: 20px;
  height: 20px;
  color: var(--visitor-cursor-color);
  pointer-events: none;
  transition:
    top 420ms cubic-bezier(0.22, 1, 0.36, 1),
    left 420ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: top, left;
}

.visitor-cursor__icon {
  flex: none;
  fill: color-mix(in srgb, currentColor 14%, transparent);
}

.visitor-cursor__label {
  position: absolute;
  top: 15px;
  left: 20px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.33;
  letter-spacing: -0.022em;
  white-space: nowrap;
}

.visitor-cursor--label-left .visitor-cursor__label {
  right: 20px;
  left: auto;
}

.visitor-cursor--label-up .visitor-cursor__label {
  top: auto;
  bottom: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .visitor-cursor {
    transition: none;
  }
}
</style>
