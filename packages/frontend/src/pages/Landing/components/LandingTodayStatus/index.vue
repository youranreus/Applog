<script setup lang="ts">
import type { IGarminTodayStatus } from '@applog/common'
import TodayCharacter from './TodayCharacter.vue'
import TodayMetrics from './TodayMetrics.vue'

withDefaults(defineProps<{
  status?: IGarminTodayStatus | null
  loading?: boolean
  unavailable?: boolean
}>(), { status: null, loading: false, unavailable: false })
</script>

<template>
  <section class="today-status" aria-labelledby="today-status-title" :aria-busy="loading">
    <header class="today-status__header">
      <div>
        <p>生活切片</p>
        <h2 id="today-status-title">今天，活得怎么样？</h2>
      </div>
      <span v-if="status?.stale" role="status">数据更新延迟</span>
    </header>

    <div v-if="loading" class="today-status__loading" aria-live="polite">
      <span class="sr-only">正在收集今天的数据…</span>
      <div class="today-status__skeleton-character" aria-hidden="true" />
      <div class="today-status__skeleton-data" aria-hidden="true">
        <i /><i /><i /><i />
      </div>
    </div>
    <div v-else-if="unavailable" class="today-status__message" role="status">今日状态暂时没有加载出来。</div>
    <div v-else class="today-status__content">
      <TodayCharacter :status="status?.evaluation.status ?? null" />
      <div class="today-status__data">
        <p class="today-status__asof">截至目前</p>
        <h3>{{ status?.evaluation.status ?? '今日数据收集中' }}</h3>
        <p class="today-status__summary">
          {{ status?.evaluation.score !== null && status?.evaluation.score !== undefined
            ? `综合状态 ${status.evaluation.score} 分`
            : '等更多数据到齐后再认真评价。' }}
        </p>
        <TodayMetrics v-if="status" :metrics="status.metrics" />
        <div v-else class="today-status__empty">Garmin 今天还没有形成可用快照。</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.today-status {
  padding-top: clamp(4.5rem, 10vw, 6.5rem);
}

.today-status__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1.25rem;
}

.today-status__header p,
.today-status__asof {
  color: var(--landing-muted);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
}

.today-status__header h2 {
  margin-top: 0.4rem;
  font-family: var(--landing-font-heading);
  font-size: clamp(1.65rem, 1.45rem + 0.7vw, 2rem);
  font-weight: 600;
  line-height: 1.18;
  letter-spacing: 0.007em;
  text-wrap: balance;
}

.today-status__header span {
  flex: none;
  color: #7a5b00;
  font-size: 0.8rem;
}

.today-status__content,
.today-status__loading {
  display: grid;
  grid-template-columns: minmax(220px, 0.82fr) minmax(0, 1.18fr);
  gap: clamp(2rem, 6vw, 4.5rem);
  padding-top: clamp(2rem, 5vw, 3.5rem);
}

.today-status__data {
  min-width: 0;
  padding-left: clamp(1.5rem, 4vw, 3rem);
}

.today-status__data h3 {
  max-width: 12ch;
  margin-top: 0.5rem;
  font-family: var(--landing-font-heading);
  font-size: clamp(1.8rem, 1.5rem + 1vw, 2.5rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: 0.011em;
  text-wrap: balance;
}

.today-status__summary {
  margin: 0.55rem 0 1.75rem;
  color: var(--landing-muted);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.today-status__message,
.today-status__empty {
  max-width: 70ch;
  padding: 1.5rem 0;
  color: var(--landing-muted);
}

.today-status__loading {
  min-height: 290px;
}

.today-status__skeleton-character,
.today-status__skeleton-data i {
  background: linear-gradient(
    100deg,
    color-mix(in srgb, var(--landing-muted) 8%, transparent) 30%,
    color-mix(in srgb, white 65%, transparent) 48%,
    color-mix(in srgb, var(--landing-muted) 8%, transparent) 66%
  );
  background-size: 220% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.today-status__skeleton-character {
  min-height: 258px;
  border-radius: 50% 50% 8px 8px;
}

.today-status__skeleton-data {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0 1.5rem;
  align-content: center;
  padding-left: clamp(1.5rem, 4vw, 3rem);
}

.today-status__skeleton-data i {
  display: block;
  height: 72px;
}

@keyframes shimmer {
  to { background-position: -120% 0; }
}

@media (max-width: 800px) {
  .today-status__content,
  .today-status__loading {
    grid-template-columns: 1fr;
    gap: 1.75rem;
  }

  .today-status__data,
  .today-status__skeleton-data {
    padding-top: 1.75rem;
    padding-left: 0;
  }
}

@media (max-width: 480px) {
  .today-status__header {
    align-items: start;
  }

  .today-status__skeleton-data {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .today-status__skeleton-character,
  .today-status__skeleton-data i {
    animation: none;
  }
}
</style>
