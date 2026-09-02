<script setup lang="ts">
import { computed } from 'vue'
import type { ITokscaleLandingStats } from '@applog/common'
import { getBrowserYmd, isTokscaleDataDelayed } from '../tokscale-utils'
import TokscaleUsageCard from './tokscale/TokscaleUsageCard.vue'

const props = withDefaults(
  defineProps<{
    stats?: ITokscaleLandingStats | null
    loading?: boolean
  }>(),
  { stats: null, loading: false },
)

const today = computed(() => getBrowserYmd())
const isDelayed = computed(
  () => props.stats?.stale === true || isTokscaleDataDelayed(props.stats?.date ?? '', today.value),
)
</script>

<template>
  <section v-if="loading" class="tokscale" aria-busy="true" aria-labelledby="tokscale-title">
    <header class="tokscale__header">
      <div>
        <p>AI Cost</p>
        <h2 id="tokscale-title">开发状态</h2>
      </div>
    </header>
    <p class="sr-only" aria-live="polite">正在加载 AI 用量数据</p>
    <div class="tokscale__skeleton tokscale__skeleton--card" aria-hidden="true" />
  </section>

  <section v-else-if="stats" class="tokscale" aria-labelledby="tokscale-title">
    <header class="tokscale__header">
      <div>
        <p>AI Cost</p>
        <h2 id="tokscale-title">开发状态</h2>
      </div>
      <p v-if="isDelayed" class="tokscale__freshness" role="status">数据更新延迟</p>
    </header>
    <TokscaleUsageCard :stats="stats" :today="today" />
  </section>
</template>

<style scoped>
.tokscale {
  min-width: 0;
  padding-top: clamp(4.5rem, 10vw, 6.5rem);
}
.tokscale__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
}
.tokscale__header p {
  margin: 0 0 0.35rem;
  color: var(--landing-muted);
  font-size: 0.75rem;
}
.tokscale__header h2 {
  margin: 0;
  font-family: var(--landing-font-heading);
  font-size: clamp(1.65rem, 4vw, 2.2rem);
  font-weight: 600;
  letter-spacing: -0.015em;
}
.tokscale__freshness {
  margin: 0 !important;
  text-align: right;
}
.tokscale__skeleton {
  display: block;
  border-radius: 4px;
  background: linear-gradient(90deg, rgb(0 0 0 / 0.05), rgb(0 0 0 / 0.1), rgb(0 0 0 / 0.05));
  background-size: 220% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
.tokscale__skeleton--card {
  height: 300px;
  margin-top: 1.5rem;
  border-radius: 13px;
}
@keyframes shimmer {
  to {
    background-position: -220% 0;
  }
}
@media (max-width: 760px) {
  .tokscale__header {
    align-items: start;
    flex-direction: column;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tokscale__skeleton {
    animation: none;
  }
}
</style>
