<script setup lang="ts">
import { computed } from 'vue'
import type { IWakaTimeLandingStats } from '@applog/common'
import WakaTimeUsageCard from './wakatime/WakaTimeUsageCard.vue'

const props = withDefaults(
  defineProps<{
    stats?: IWakaTimeLandingStats | null
    loading?: boolean
  }>(),
  { stats: null, loading: false },
)

const isStale = computed(() => props.stats?.stale === true)
</script>

<template>
  <section v-if="loading" class="wakatime" aria-busy="true" aria-labelledby="wakatime-title">
    <header class="wakatime__header">
      <div>
        <p>AI Cost</p>
        <h2 id="wakatime-title">开发状态</h2>
      </div>
    </header>
    <p class="sr-only" aria-live="polite">正在加载编码数据</p>
    <div class="wakatime__skeleton wakatime__skeleton--card" aria-hidden="true" />
  </section>

  <section v-else-if="stats" class="wakatime" aria-labelledby="wakatime-title">
    <header class="wakatime__header">
      <div>
        <p>AI Cost</p>
        <h2 id="wakatime-title">开发状态</h2>
      </div>
      <p v-if="isStale" class="wakatime__freshness" role="status">数据更新延迟</p>
    </header>
    <WakaTimeUsageCard :stats="stats" />
  </section>
</template>

<style scoped>
.wakatime {
  min-width: 0;
  padding-top: clamp(4.5rem, 10vw, 6.5rem);
}
.wakatime__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
}
.wakatime__header p {
  margin: 0 0 0.35rem;
  color: var(--landing-muted);
  font-size: 0.75rem;
}
.wakatime__header h2 {
  margin: 0;
  font-family: var(--landing-font-heading);
  font-size: clamp(1.65rem, 4vw, 2.2rem);
  font-weight: 600;
  letter-spacing: -0.015em;
}
.wakatime__freshness {
  margin: 0 !important;
  text-align: right;
}
.wakatime__skeleton {
  display: block;
  border-radius: 4px;
  background: linear-gradient(90deg, rgb(0 0 0 / 0.05), rgb(0 0 0 / 0.1), rgb(0 0 0 / 0.05));
  background-size: 220% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
.wakatime__skeleton--card {
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
  .wakatime__header {
    align-items: start;
    flex-direction: column;
  }
}
@media (prefers-reduced-motion: reduce) {
  .wakatime__skeleton {
    animation: none;
  }
}
</style>
