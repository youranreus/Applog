<script setup lang="ts">
import type { IProps } from './types'
import { useLandingGarminStatsPresentation } from './hooks/useLandingGarminStatsPresentation'

defineOptions({
  name: 'LandingGarminStats',
})

const props = withDefaults(defineProps<IProps>(), {
  stats: null,
  loading: false,
})
const { totalText, fetchedAtText, activities } = useLandingGarminStatsPresentation(props)
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
    <div class="garmin-stats__grid" aria-hidden="true">
      <article v-for="index in 6" :key="index" class="garmin-activity garmin-activity--skeleton">
        <div class="garmin-skeleton garmin-skeleton--route" />
        <div class="garmin-skeleton garmin-skeleton--title" />
        <div class="garmin-skeleton garmin-skeleton--meta" />
      </article>
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

    <div v-if="activities.length" class="garmin-stats__grid">
      <article v-for="activity in activities" :key="activity.key" class="garmin-activity">
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
        <div v-else class="garmin-activity__route-empty" aria-hidden="true">室内 / 无 GPS</div>

        <div class="garmin-activity__body">
          <div class="garmin-activity__primary">
            <h3 class="garmin-activity__title">{{ activity.typeDisplay }}</h3>
            <time class="garmin-activity__date">{{ activity.dateText }}</time>
          </div>
          <p class="garmin-activity__metrics">
            <span>{{ activity.distanceText }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ activity.durationText }}</span>
          </p>
          <p class="garmin-activity__source">{{ activity.sourceText }}</p>
        </div>
      </article>
    </div>

    <p class="garmin-stats__disclaimer">
      数据来源于 Garmin Connect；本页面与 Garmin Ltd. 无官方关联。
    </p>
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

.garmin-stats__stale,
.garmin-stats__disclaimer,
.garmin-activity__source {
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

.garmin-stats__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.garmin-activity {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(7.5rem, 42%) minmax(0, 1fr);
  gap: 1rem;
  padding: 0.875rem;
  border: 1px solid color-mix(in srgb, var(--landing-muted) 18%, transparent);
  border-radius: 16px;
  background: var(--landing-surface);
}

.garmin-activity__route,
.garmin-activity__route-empty {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 10px;
  background: var(--landing-surface-soft);
}

.garmin-activity__route {
  padding: 0.45rem;
  overflow: visible;
}

.garmin-activity__route-empty {
  display: grid;
  place-items: center;
  color: var(--landing-muted);
  font-size: 0.6875rem;
}

.garmin-activity__path {
  fill: none;
  stroke: var(--landing-primary);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.garmin-activity__start {
  fill: var(--landing-primary);
  stroke: var(--landing-surface);
  stroke-width: 1.25;
}

.garmin-activity__end {
  fill: var(--landing-text);
  stroke: var(--landing-surface);
  stroke-width: 1.25;
}

.garmin-activity__body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
}

.garmin-activity__primary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.garmin-activity__title {
  color: var(--landing-text);
  font-size: 1rem;
  font-weight: 600;
}

.garmin-activity__date,
.garmin-activity__metrics {
  color: var(--landing-muted);
  font-size: 0.75rem;
}

.garmin-activity__date {
  flex: none;
}

.garmin-activity__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
  color: var(--landing-text);
  font-variant-numeric: tabular-nums;
}

.garmin-activity__source {
  margin-top: 0.45rem;
}

.garmin-stats__disclaimer {
  margin-top: 1rem;
}

.garmin-stats__skeleton {
  width: 15rem;
  height: 1.5rem;
}

.garmin-activity--skeleton {
  display: block;
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

.garmin-skeleton--route {
  width: 100%;
  aspect-ratio: 4 / 3;
}

.garmin-skeleton--title {
  width: 45%;
  height: 1rem;
  margin-top: 0.75rem;
}

.garmin-skeleton--meta {
  width: 70%;
  height: 0.75rem;
  margin-top: 0.5rem;
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

  .garmin-stats__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 430px) {
  .garmin-activity {
    grid-template-columns: minmax(6.5rem, 38%) minmax(0, 1fr);
    gap: 0.75rem;
  }

  .garmin-activity__primary {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.2rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .garmin-skeleton,
  .garmin-stats__skeleton {
    animation: none;
  }
}
</style>
