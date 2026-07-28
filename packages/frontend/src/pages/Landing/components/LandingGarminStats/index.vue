<script setup lang="ts">
import { CalendarIcon, FlameIcon, MapPinIcon, TimerIcon } from '@lucide/vue'
import { nextTick, watch } from 'vue'
import ActivityTypeCover from './ActivityTypeCover.vue'
import { useHorizontalScrollFades } from './hooks/useHorizontalScrollFades'
import { useLandingGarminStatsPresentation } from './hooks/useLandingGarminStatsPresentation'
import type { IProps } from './types'

defineOptions({
  name: 'LandingGarminStats',
})

const props = withDefaults(defineProps<IProps>(), {
  stats: null,
  loading: false,
})
const { totalText, fetchedAtText, activities } = useLandingGarminStatsPresentation(props)
const { scrollRef, canScrollLeft, canScrollRight, updateScrollFades } =
  useHorizontalScrollFades()

watch(
  () => [props.loading, props.stats, activities.value.length] as const,
  async () => {
    await nextTick()
    updateScrollFades()
  },
)
</script>

<template>
  <section
    v-if="loading"
    class="garmin-stats"
    aria-busy="true"
    aria-labelledby="garmin-stats-title"
  >
    <header class="garmin-stats__header">
      <div class="garmin-stats__heading">
        <p class="garmin-stats__eyebrow">运动轨迹</p>
        <h2 id="garmin-stats-title" class="garmin-stats__title">最近的运动</h2>
      </div>
    </header>
    <p class="sr-only" aria-live="polite">正在加载运动数据</p>
    <div class="garmin-stats__summary garmin-stats__skeleton" aria-hidden="true" />
    <div class="garmin-stats__track-shell" aria-hidden="true">
      <div class="garmin-stats__track">
        <article
          v-for="index in 6"
          :key="index"
          class="garmin-activity garmin-activity--skeleton"
        >
          <div class="garmin-skeleton garmin-skeleton--cover" />
          <div class="garmin-skeleton garmin-skeleton--title" />
          <div class="garmin-skeleton garmin-skeleton--meta" />
        </article>
      </div>
    </div>
  </section>

  <section v-else-if="stats" class="garmin-stats" aria-labelledby="garmin-stats-title">
    <header class="garmin-stats__header">
      <div class="garmin-stats__heading">
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
        <article v-for="activity in activities" :key="activity.key" class="garmin-activity">
          <div class="garmin-activity__cover">
            <svg
              v-if="activity.route"
              class="garmin-activity__route"
              :viewBox="activity.route.viewBox"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              :aria-label="`${activity.typeDisplay}完整路线预览，圆点为起点，方点为终点`"
            >
              <path
                class="garmin-activity__path"
                :d="activity.route.pathData"
                vector-effect="non-scaling-stroke"
              />
              <circle
                class="garmin-activity__start"
                :cx="activity.route.endpoints.start.x"
                :cy="activity.route.endpoints.start.y"
                r="2.5"
              />
              <rect
                class="garmin-activity__end"
                :x="activity.route.endpoints.end.x - 2.5"
                :y="activity.route.endpoints.end.y - 2.5"
                width="5"
                height="5"
                rx="1"
              />
            </svg>
            <ActivityTypeCover
              v-else
              :type="activity.type"
              :type-display="activity.typeDisplay"
            />
            <span
              v-if="activity.distanceText"
              class="garmin-activity__distance-tag"
            >
              {{ activity.distanceText }}
            </span>
          </div>

          <div class="garmin-activity__body">
            <h3 class="garmin-activity__title">{{ activity.typeDisplay }}</h3>
            <div class="garmin-activity__row">
              <span class="garmin-activity__metric">
                <CalendarIcon aria-hidden="true" />
                <time>{{ activity.dateText }}</time>
              </span>
              <span v-if="activity.locationText" class="garmin-activity__metric">
                <MapPinIcon aria-hidden="true" />
                <span>{{ activity.locationText }}</span>
              </span>
            </div>
            <div class="garmin-activity__row">
              <span v-if="activity.caloriesText" class="garmin-activity__metric">
                <FlameIcon aria-hidden="true" />
                <span>{{ activity.caloriesText }}</span>
              </span>
              <span class="garmin-activity__metric">
                <TimerIcon aria-hidden="true" />
                <span>{{ activity.durationText }}</span>
              </span>
            </div>
          </div>
        </article>
      </div>
    </div>

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
  line-height: 1.5;
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
  top: 0;
  bottom: 0;
  z-index: 1;
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
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}

.garmin-stats__track:focus-visible {
  outline: 2px solid var(--landing-primary);
  outline-offset: 3px;
  border-radius: 12px;
}

.garmin-activity {
  display: flex;
  flex: 0 0 11.5rem;
  flex-direction: column;
  min-width: 11.5rem;
  max-width: 11.5rem;
  height: 100%;
  scroll-snap-align: start;
  border: 1px solid color-mix(in srgb, var(--landing-muted) 18%, transparent);
  border-radius: 12px;
  background: var(--landing-surface);
  overflow: hidden;
}

.garmin-activity__cover {
  position: relative;
  flex: none;
  aspect-ratio: 1 / 1;
  background: var(--landing-surface-soft);
}

.garmin-activity__route {
  display: block;
  width: 100%;
  height: 100%;
  padding: 1.35rem;
  overflow: visible;
}

.garmin-activity__distance-tag {
  position: absolute;
  left: 0.4rem;
  bottom: 0.4rem;
  z-index: 1;
  max-width: calc(100% - 0.8rem);
  padding: 0.15rem 0.4rem;
  overflow: hidden;
  border-radius: 980px;
  border: 1px solid color-mix(in srgb, var(--landing-muted) 14%, transparent);
  background: color-mix(in srgb, var(--landing-surface) 90%, transparent);
  color: var(--landing-text);
  font-size: 0.625rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(6px);
}

.garmin-activity__path {
  fill: none;
  stroke: color-mix(in srgb, var(--landing-muted) 58%, var(--landing-text));
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.75;
}

.garmin-activity__start {
  fill: var(--landing-text);
  stroke: var(--landing-surface-soft);
  stroke-width: 1.25;
}

.garmin-activity__end {
  fill: var(--landing-muted);
  stroke: var(--landing-surface-soft);
  stroke-width: 1.25;
}

.garmin-activity__body {
  display: grid;
  min-width: 0;
  flex: 1;
  grid-template-rows: auto auto auto;
  gap: 0.22rem;
  padding: 0.5rem 0.6rem 0.6rem;
}

.garmin-activity__title {
  min-width: 0;
  overflow: hidden;
  color: var(--landing-text);
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.garmin-activity__row {
  display: flex;
  min-width: 0;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.45rem;
  overflow: hidden;
  color: var(--landing-muted);
  font-size: 0.6875rem;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
}

.garmin-activity__metric {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.22rem;
}

.garmin-activity__metric span,
.garmin-activity__metric time {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.garmin-activity__metric svg {
  width: 0.7rem;
  height: 0.7rem;
  flex: none;
  stroke-width: 1.7;
}

.garmin-stats__skeleton {
  width: 15rem;
  height: 1.5rem;
}

.garmin-activity--skeleton {
  padding: 0;
}

.garmin-skeleton,
.garmin-stats__skeleton {
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--landing-muted) 12%, transparent) 25%,
    color-mix(in srgb, var(--landing-muted) 24%, transparent) 50%,
    color-mix(in srgb, var(--landing-muted) 12%, transparent) 75%
  );
  background-size: 200% 100%;
  animation: garmin-skeleton-shimmer 1.6s ease-in-out infinite;
}

.garmin-skeleton--cover {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 0;
}

.garmin-skeleton--title {
  width: 42%;
  height: 0.75rem;
  margin: 0.55rem 0.65rem 0;
}

.garmin-skeleton--meta {
  width: 68%;
  height: 0.625rem;
  margin: 0.3rem 0.65rem 0.65rem;
}

@keyframes garmin-skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (max-width: 720px) {
  .garmin-stats__header {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.5rem;
  }

  .garmin-activity {
    flex-basis: 10.75rem;
    min-width: 10.75rem;
    max-width: 10.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .garmin-skeleton,
  .garmin-stats__skeleton,
  .garmin-stats__track-shell::before,
  .garmin-stats__track-shell::after {
    animation: none;
    transition: none;
  }
}
</style>
