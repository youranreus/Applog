<script setup lang="ts">
import { nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'
import GarminActivityCard from './GarminActivityCard.vue'
import GarminActivityDetailDialog from './GarminActivityDetailDialog.vue'
import { useGarminActivityDetail } from './hooks/useGarminActivityDetail'
import { useHorizontalScrollFades } from './hooks/useHorizontalScrollFades'
import { useLandingGarminStatsPresentation } from './hooks/useLandingGarminStatsPresentation'
import type { IGarminActivityView, IProps } from './types'

defineOptions({ name: 'LandingGarminStats' })

const props = withDefaults(defineProps<IProps>(), {
  stats: null,
  loading: false,
})
const { totalText, fetchedAtText, activities } = useLandingGarminStatsPresentation(props)
const { scrollRef, canScrollLeft, canScrollRight, updateScrollFades } = useHorizontalScrollFades()
const { detail, loading: detailLoading, error, load, clear } = useGarminActivityDetail()
const selectedActivity = shallowRef<IGarminActivityView | null>(null)
const sourceElement = shallowRef<HTMLElement | null>(null)
const detailOpen = shallowRef(false)
let closeTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => [props.loading, props.stats, activities.value.length] as const,
  async () => {
    await nextTick()
    updateScrollFades()
  },
)

function openActivity(activity: IGarminActivityView, element: HTMLElement): void {
  if (!activity.publicId || !activity.route) return
  if (closeTimer) {
    window.clearTimeout(closeTimer)
    closeTimer = undefined
  }
  selectedActivity.value = activity
  sourceElement.value = element
  detailOpen.value = true
  void load(activity.publicId)
}

function setDetailOpen(open: boolean): void {
  if (open) return
  detailOpen.value = false
  const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 330
  closeTimer = window.setTimeout(() => {
    sourceElement.value?.focus()
    selectedActivity.value = null
    sourceElement.value = null
    clear()
    closeTimer = undefined
  }, delay)
}

function retryDetail(): void {
  if (selectedActivity.value?.publicId) {
    void load(selectedActivity.value.publicId, true)
  }
}

onBeforeUnmount(() => {
  if (closeTimer) window.clearTimeout(closeTimer)
})
</script>

<template>
  <section
    v-if="loading"
    class="garmin-stats"
    aria-busy="true"
    aria-labelledby="garmin-stats-title"
  >
    <header class="garmin-stats__header">
      <div>
        <p class="garmin-stats__eyebrow">运动轨迹</p>
        <h2 id="garmin-stats-title" class="garmin-stats__title">最近的运动</h2>
      </div>
    </header>
    <p class="sr-only" aria-live="polite">正在加载运动数据</p>
    <div class="garmin-stats__summary garmin-skeleton" aria-hidden="true" />
    <div class="garmin-stats__track" aria-hidden="true">
      <div v-for="index in 6" :key="index" class="garmin-stats__card-skeleton" />
    </div>
  </section>

  <section v-else-if="stats" class="garmin-stats" aria-labelledby="garmin-stats-title">
    <header class="garmin-stats__header">
      <div>
        <p class="garmin-stats__eyebrow">运动轨迹</p>
        <h2 id="garmin-stats-title" class="garmin-stats__title">最近的运动</h2>
      </div>
      <p v-if="stats.stale" class="garmin-stats__stale" role="status">
        最近一次同步于 {{ fetchedAtText }}
      </p>
    </header>

    <p class="garmin-stats__summary">
      Garmin Connect 已累计记录
      <strong class="garmin-stats__count">{{ totalText }}</strong>
      次活动
    </p>

    <div
      v-if="activities.length"
      class="garmin-stats__track-shell"
      :class="{
        'garmin-stats__track-shell--fade-left': canScrollLeft,
        'garmin-stats__track-shell--fade-right': canScrollRight,
      }"
    >
      <div
        ref="scrollRef"
        class="garmin-stats__track"
        tabindex="0"
        role="region"
        aria-label="最近的运动活动列表，可左右滑动"
        @scroll="updateScrollFades"
      >
        <GarminActivityCard
          v-for="activity in activities"
          :key="activity.key"
          :activity="activity"
          @activate="openActivity"
        />
      </div>
    </div>

    <GarminActivityDetailDialog
      :open="detailOpen"
      :activity="selectedActivity"
      :detail="detail"
      :loading="detailLoading"
      :error="error"
      @update-open="setDetailOpen"
      @retry="retryDetail"
    />
  </section>
</template>

<style scoped>
.garmin-stats {
  min-width: 0;
  padding-top: clamp(4.5rem, 10vw, 6.5rem);
}

.garmin-stats__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
}

.garmin-stats__eyebrow {
  margin-bottom: 0.35rem;
  color: var(--landing-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.garmin-stats__title {
  color: var(--landing-text);
  font-family: var(--landing-font-heading);
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.18;
}

.garmin-stats__stale {
  color: var(--landing-muted);
  font-size: 0.75rem;
}

.garmin-stats__summary {
  margin-top: 1.25rem;
  color: var(--landing-muted);
  font-size: 0.9375rem;
}

.garmin-stats__count {
  color: var(--landing-text);
  font-family: var(--landing-font-heading);
  font-size: 1.5rem;
  font-weight: 650;
}

.garmin-stats__track-shell {
  position: relative;
  margin-top: 1.25rem;
}

.garmin-stats__track-shell::before,
.garmin-stats__track-shell::after {
  content: '';
  position: absolute;
  inset-block: 0;
  z-index: 2;
  width: 2.5rem;
  pointer-events: none;
  opacity: 0;
  transition: opacity 160ms ease;
}

.garmin-stats__track-shell::before {
  left: 0;
  background: linear-gradient(to right, var(--landing-canvas), transparent);
}

.garmin-stats__track-shell::after {
  right: 0;
  background: linear-gradient(to left, var(--landing-canvas), transparent);
}

.garmin-stats__track-shell--fade-left::before,
.garmin-stats__track-shell--fade-right::after {
  opacity: 1;
}

.garmin-stats__track {
  display: flex;
  align-items: stretch;
  gap: 0.6rem;
  margin-top: 1.25rem;
  padding: 0.2rem 0 0.35rem;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}

.garmin-stats__track-shell .garmin-stats__track {
  margin-top: 0;
}

.garmin-stats__track:focus-visible {
  outline: 2px solid var(--landing-primary);
  outline-offset: 3px;
}

.garmin-skeleton,
.garmin-stats__card-skeleton {
  border-radius: 6px;
  background: color-mix(in srgb, var(--landing-muted) 13%, transparent);
  animation: garmin-pulse 1.6s ease-in-out infinite;
}

.garmin-skeleton {
  width: 15rem;
  height: 1.5rem;
}

.garmin-stats__card-skeleton {
  flex: 0 0 11.5rem;
  aspect-ratio: 0.72;
}

@keyframes garmin-pulse {
  50% {
    opacity: 0.55;
  }
}

@media (max-width: 720px) {
  .garmin-stats__header {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .garmin-skeleton,
  .garmin-stats__card-skeleton,
  .garmin-stats__track-shell::before,
  .garmin-stats__track-shell::after {
    animation: none;
    transition: none;
  }
}
</style>
