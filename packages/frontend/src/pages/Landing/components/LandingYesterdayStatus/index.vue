<script setup lang="ts">
import type { IGarminYesterdayStatus } from '@applog/common'
import YesterdayCharacter from './YesterdayCharacter.vue'
import YesterdayMetrics from './YesterdayMetrics.vue'

withDefaults(
  defineProps<{
    status?: IGarminYesterdayStatus | null
    loading?: boolean
    unavailable?: boolean
  }>(),
  { status: null, loading: false, unavailable: false },
)
</script>

<template>
  <section class="yesterday-status" aria-labelledby="yesterday-status-title" :aria-busy="loading">
    <header class="yesterday-status__header">
      <div>
        <p>生活切片</p>
        <h2 id="yesterday-status-title">近期状态</h2>
      </div>
      <span v-if="status?.stale" role="status">数据更新延迟</span>
    </header>

    <div v-if="loading" class="yesterday-status__loading" aria-live="polite">
      <span class="sr-only">正在加载状态数据…</span>
      <div class="yesterday-status__skeleton-character" aria-hidden="true" />
      <div class="yesterday-status__skeleton-data" aria-hidden="true"><i /><i /><i /><i /></div>
    </div>
    <div v-else-if="unavailable" class="yesterday-status__message" role="status">
      状态暂时没有加载出来。
    </div>
    <div v-else class="yesterday-status__content">
      <YesterdayCharacter :status="status?.evaluation.status ?? null" />
      <div class="yesterday-status__data">
        <p class="yesterday-status__asof">状态概览</p>
        <h3>{{ status?.evaluation.status ?? '数据暂缺' }}</h3>
        <p class="yesterday-status__summary">
          {{
            status?.evaluation.score !== null && status?.evaluation.score !== undefined
              ? `综合状态 ${status.evaluation.score} 分`
              : '有效数据不足，暂不评价。'
          }}
        </p>
        <YesterdayMetrics v-if="status" :metrics="status.metrics" />
        <div v-else class="yesterday-status__empty">Garmin 暂无可用快照。</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.yesterday-status {
  padding-top: clamp(4.5rem, 10vw, 6.5rem);
}

.yesterday-status__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1.25rem;
}

.yesterday-status__header p,
.yesterday-status__asof {
  color: var(--landing-muted);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
}

.yesterday-status__header h2 {
  margin-top: 0.4rem;
  font-family: var(--landing-font-heading);
  font-size: clamp(1.65rem, 1.45rem + 0.7vw, 2rem);
  font-weight: 600;
  line-height: 1.18;
  letter-spacing: 0.007em;
  text-wrap: balance;
}

.yesterday-status__header span {
  flex: none;
  color: #7a5b00;
  font-size: 0.8rem;
}

.yesterday-status__content,
.yesterday-status__loading {
  display: grid;
  grid-template-columns: minmax(220px, 0.82fr) minmax(0, 1.18fr);
  gap: clamp(2rem, 6vw, 4.5rem);
  padding-top: clamp(2rem, 5vw, 3.5rem);
}

.yesterday-status__data {
  min-width: 0;
  padding-left: clamp(1.5rem, 4vw, 3rem);
}

.yesterday-status__data h3 {
  max-width: 12ch;
  margin-top: 0.5rem;
  font-family: var(--landing-font-heading);
  font-size: clamp(1.8rem, 1.5rem + 1vw, 2.5rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: 0.011em;
  text-wrap: balance;
}

.yesterday-status__summary {
  margin: 0.55rem 0 1.75rem;
  color: var(--landing-muted);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.yesterday-status__message,
.yesterday-status__empty {
  max-width: 70ch;
  padding: 1.5rem 0;
  color: var(--landing-muted);
}

.yesterday-status__loading {
  min-height: 290px;
}

.yesterday-status__skeleton-character,
.yesterday-status__skeleton-data i {
  background: linear-gradient(
    100deg,
    color-mix(in srgb, var(--landing-muted) 8%, transparent) 30%,
    color-mix(in srgb, white 65%, transparent) 48%,
    color-mix(in srgb, var(--landing-muted) 8%, transparent) 66%
  );
  background-size: 220% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.yesterday-status__skeleton-character {
  min-height: 258px;
  border-radius: 50% 50% 8px 8px;
}

.yesterday-status__skeleton-data {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0 1.5rem;
  align-content: center;
  padding-left: clamp(1.5rem, 4vw, 3rem);
}

.yesterday-status__skeleton-data i {
  display: block;
  height: 72px;
}

@keyframes shimmer {
  to {
    background-position: -120% 0;
  }
}

@media (max-width: 800px) {
  .yesterday-status__content,
  .yesterday-status__loading {
    grid-template-columns: 1fr;
    gap: 1.75rem;
  }

  .yesterday-status__data,
  .yesterday-status__skeleton-data {
    padding-top: 1.75rem;
    padding-left: 0;
  }
}

@media (max-width: 480px) {
  .yesterday-status__header {
    align-items: start;
  }

  .yesterday-status__skeleton-data {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .yesterday-status__skeleton-character,
  .yesterday-status__skeleton-data i {
    animation: none;
  }
}
</style>
