<script setup lang="ts">
import { Button } from '@/components/ui/button'

/**
 * 后台列表页头 Props
 */
interface IAdminListHeaderProps {
  /** 主标题 */
  title: string
  /** 主操作按钮文案 */
  createLabel: string
  /** 是否禁用主操作 */
  createDisabled?: boolean
}

/**
 * 后台列表页头 Emits
 */
interface IAdminListHeaderEmits {
  /** 点击主操作（新建） */
  (e: 'create'): void
}

withDefaults(defineProps<IAdminListHeaderProps>(), {
  createDisabled: false,
})

const emit = defineEmits<IAdminListHeaderEmits>()

/**
 * 触发新建
 */
function handleCreate(): void {
  emit('create')
}
</script>

<template>
  <header class="admin-list-header">
    <h1 class="admin-list-header__title">
      <span class="admin-list-header__title-text">{{ title }}</span>
      <svg
        class="admin-list-header__wave"
        viewBox="0 0 48 12"
        preserveAspectRatio="xMinYMid meet"
        aria-hidden="true"
      >
        <path
          d="M3 7 C 12 2.5, 18 2.5, 24 7 S 36 11.5, 45 7"
          fill="none"
          stroke="currentColor"
          stroke-width="2.75"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </h1>

    <div class="admin-list-header__actions">
      <slot name="before-action" />
      <Button
        type="button"
        class="admin-list-header__create shrink-0"
        :disabled="createDisabled"
        @click="handleCreate"
      >
        {{ createLabel }}
      </Button>
    </div>
  </header>
</template>

<style scoped>
.admin-list-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem 1.5rem;
  margin-bottom: 2.5rem;
}

.admin-list-header__title {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  margin: 0;
  padding-bottom: 2px;
  overflow: visible;
  font-family: var(--font-heading, inherit);
  font-size: clamp(1.75rem, 1.4rem + 1.2vw, 2.25rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--color-carbon, #1d1d1f);
  text-wrap: balance;
}

.admin-list-header__title-text {
  display: block;
}

.admin-list-header__wave {
  display: block;
  width: 2.1em;
  height: 12px;
  margin-top: 2px;
  overflow: visible;
  color: var(--color-signal-blue, #2997ff);
  opacity: 0.65;
  pointer-events: none;
}

.admin-list-header__create {
  min-height: 2.25rem;
  padding-inline: 1rem;
}

.admin-list-header__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.625rem;
  margin-top: 0.15rem;
}
</style>
