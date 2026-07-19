<script lang="ts" setup>
import type { ToasterProps } from 'vue-sonner'

import { XIcon } from '@lucide/vue'
import { reactiveOmit } from '@vueuse/core'
import { Toaster as Sonner } from 'vue-sonner'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<ToasterProps>(), {
  theme: 'light',
  position: 'top-center',
  closeButton: true,
  richColors: false,
  expand: true,
  gap: 10,
  visibleToasts: 4,
  duration: 3200,
})

const delegatedProps = reactiveOmit(props, 'class', 'toastOptions')

/**
 * toast 默认样式类：纯文字通知条，无类型图标
 */
const defaultToastOptions: NonNullable<ToasterProps['toastOptions']> = {
  unstyled: false,
  classes: {
    toast: 'applog-toast',
    title: 'applog-toast__title',
    description: 'applog-toast__description',
    icon: 'applog-toast__icon',
    closeButton: 'applog-toast__close',
    success: 'applog-toast--success',
    error: 'applog-toast--error',
    info: 'applog-toast--info',
    warning: 'applog-toast--warning',
  },
}
</script>

<template>
  <Sonner
    :class="cn('toaster group applog-toaster', props.class)"
    :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--border-radius': '12px',
      '--width': '380px',
    }"
    :toast-options="props.toastOptions ?? defaultToastOptions"
    v-bind="delegatedProps"
  >
    <template #success-icon />
    <template #info-icon />
    <template #warning-icon />
    <template #error-icon />
    <template #loading-icon />
    <template #close-icon>
      <XIcon class="size-3.5" stroke-width="2" />
    </template>
  </Sonner>
</template>

<style>
/**
 * AppLog toast — 白底细边、纯文字、类型仅靠边框/底色轻区分
 */
.applog-toaster[data-sonner-toaster] {
  font-family: var(--font-sans, inherit);
}

.applog-toast[data-sonner-toast] {
  --toast-bg: #ffffff;
  --toast-fg: var(--color-carbon, #1d1d1f);
  --toast-muted: var(--color-ash, #707070);
  --toast-border: var(--color-pebble, #e2e2e5);
  --toast-shadow: 0 2px 8px rgba(29, 29, 31, 0.08), 0 0 0 1px rgba(29, 29, 31, 0.04);

  width: var(--width);
  max-width: min(380px, calc(100vw - 32px));
  align-items: flex-start;
  gap: 0;
  padding: 14px 16px;
  margin: 0;
  background: var(--toast-bg) !important;
  color: var(--toast-fg) !important;
  border: 1px solid var(--toast-border) !important;
  border-radius: 12px !important;
  box-shadow: var(--toast-shadow) !important;
  font-size: 14px;
  line-height: 1.35;
}

.applog-toast[data-sonner-toast][data-expanded='true'] {
  box-shadow: var(--toast-shadow) !important;
}

.applog-toast__icon,
.applog-toast[data-sonner-toast] [data-icon] {
  display: none !important;
}

.applog-toast__title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--toast-fg);
}

.applog-toast__description {
  margin-top: 2px !important;
  font-size: 13px !important;
  font-weight: 400;
  line-height: 1.4;
  color: var(--toast-muted) !important;
  opacity: 1 !important;
}

.applog-toast--error {
  --toast-border: #f0d0d0;
  --toast-bg: #fffbfb;
}

.applog-toast__close {
  position: absolute !important;
  top: 10px !important;
  right: 10px !important;
  left: auto !important;
  transform: none !important;
  width: 24px !important;
  height: 24px !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  border: none !important;
  border-radius: 980px !important;
  background: transparent !important;
  color: var(--color-mist, #858585) !important;
  box-shadow: none !important;
  opacity: 0;
  transition: opacity 0.15s ease-out, background-color 0.15s ease-out, color 0.15s ease-out;
}

.applog-toast[data-sonner-toast]:hover .applog-toast__close,
.applog-toast[data-sonner-toast]:focus-within .applog-toast__close {
  opacity: 1;
}

.applog-toast__close:hover {
  background: var(--color-frost, #f5f5f7) !important;
  color: var(--color-carbon, #1d1d1f) !important;
}

.applog-toast__close:focus-visible {
  opacity: 1;
  outline: 2px solid var(--color-apple-blue, #0071e3);
  outline-offset: 1px;
}

.applog-toast[data-sonner-toast][data-close-button='true'] [data-content] {
  padding-right: 20px;
}

@media (prefers-reduced-motion: reduce) {
  .applog-toast__close {
    opacity: 1;
    transition: none;
  }
}
</style>
