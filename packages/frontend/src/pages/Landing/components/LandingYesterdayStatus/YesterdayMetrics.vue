<script setup lang="ts">
import { computed } from 'vue'
import type { IGarminYesterdayMetrics } from '@applog/common'
import { formatMetric, formatSleep } from './utils'

const props = defineProps<{ metrics: IGarminYesterdayMetrics }>()
const sleep = computed(() => formatSleep(props.metrics.sleep))
const stepProgress = computed(() =>
  Math.min(100, Math.max(0, ((props.metrics.steps ?? 0) / props.metrics.stepGoal) * 100)),
)
</script>

<template>
  <div class="yesterday-metrics">
    <div class="yesterday-metrics__progress-item">
      <div class="yesterday-metrics__row">
        <span>步数</span>
        <strong>{{ formatMetric(metrics.steps, ' 步') }}</strong>
      </div>
      <div
        class="yesterday-progress"
        role="progressbar"
        aria-label="步数进度"
        :aria-valuenow="metrics.steps ?? undefined"
        :aria-valuetext="metrics.steps === null ? '数据缺失' : undefined"
        aria-valuemin="0"
        :aria-valuemax="metrics.stepGoal"
      >
        <span :style="{ width: `${stepProgress}%` }" />
      </div>
      <small>目标 {{ metrics.stepGoal.toLocaleString('zh-CN') }} 步</small>
    </div>

    <div class="yesterday-metrics__progress-item">
      <div class="yesterday-metrics__row">
        <span>身体电池</span>
        <strong>{{ formatMetric(metrics.bodyBattery, '%') }}</strong>
      </div>
      <div
        class="yesterday-progress yesterday-progress--battery"
        role="progressbar"
        aria-label="身体电池"
        :aria-valuenow="metrics.bodyBattery ?? undefined"
        :aria-valuetext="metrics.bodyBattery === null ? '数据缺失' : undefined"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span :style="{ width: `${metrics.bodyBattery ?? 0}%` }" />
      </div>
    </div>

    <dl class="yesterday-metrics__grid">
      <div>
        <dt>静息心率</dt>
        <dd>{{ formatMetric(metrics.restingHeartRateBpm, ' bpm') }}</dd>
      </div>
      <div>
        <dt>强度活动</dt>
        <dd>{{ formatMetric(metrics.intensityMinutes, ' 分钟') }}</dd>
      </div>
      <div>
        <dt>平均压力</dt>
        <dd>{{ formatMetric(metrics.averageStressLevel, '') }}</dd>
      </div>
      <div>
        <dt>{{ sleep.label }}</dt>
        <dd>{{ sleep.value }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.yesterday-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 1.5rem;
}
.yesterday-metrics__progress-item {
  padding: 1rem 0 1.15rem;
}
.yesterday-metrics__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.875rem;
}
.yesterday-metrics__row span {
  color: var(--landing-muted);
}
.yesterday-metrics__row strong {
  color: var(--landing-text);
  font-size: 1.0625rem;
  font-variant-numeric: tabular-nums;
}
.yesterday-progress {
  height: 0.25rem;
  margin-top: 0.7rem;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--landing-muted) 20%, transparent);
}
.yesterday-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--landing-primary);
  transition: width 500ms ease;
}
.yesterday-progress--battery span {
  background: #34c759;
}
.yesterday-metrics small {
  display: block;
  margin-top: 0.45rem;
  color: var(--landing-muted);
  font-size: 0.75rem;
}
.yesterday-metrics__grid {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 1.5rem;
}
.yesterday-metrics__grid div {
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 0;
}
.yesterday-metrics dt {
  color: var(--landing-muted);
  font-size: 0.8125rem;
}
.yesterday-metrics dd {
  color: var(--landing-text);
  font-size: 0.9375rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
  text-align: right;
}
@media (max-width: 480px) {
  .yesterday-metrics,
  .yesterday-metrics__grid {
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .yesterday-progress span {
    transition: none;
  }
}
</style>
