<script setup lang="ts">
import { computed } from 'vue'
import type { IGarminTodayMetrics } from '@applog/common'
import { formatMetric, formatSleep } from './utils'

const props = defineProps<{ metrics: IGarminTodayMetrics }>()
const sleep = computed(() => formatSleep(props.metrics.sleep))
const stepProgress = computed(() =>
  Math.min(100, Math.max(0, ((props.metrics.steps ?? 0) / props.metrics.stepGoal) * 100)),
)
</script>

<template>
  <div class="today-metrics">
    <div class="today-metrics__progress-card">
      <div class="today-metrics__row">
        <span>步数</span>
        <strong>{{ formatMetric(metrics.steps, ' 步') }}</strong>
      </div>
      <div
        class="today-progress"
        role="progressbar"
        aria-label="今日步数进度"
        :aria-valuenow="metrics.steps ?? undefined"
        :aria-valuetext="metrics.steps === null ? '数据缺失' : undefined"
        aria-valuemin="0"
        :aria-valuemax="metrics.stepGoal"
      >
        <span :style="{ width: `${stepProgress}%` }" />
      </div>
      <small>目标 {{ metrics.stepGoal.toLocaleString('zh-CN') }} 步</small>
    </div>

    <div class="today-metrics__progress-card">
      <div class="today-metrics__row">
        <span>身体电池</span>
        <strong>{{ formatMetric(metrics.bodyBattery, '%') }}</strong>
      </div>
      <div
        class="today-progress today-progress--battery"
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

    <dl class="today-metrics__grid">
      <div><dt>静息心率</dt><dd>{{ formatMetric(metrics.restingHeartRateBpm, ' bpm') }}</dd></div>
      <div><dt>强度活动</dt><dd>{{ formatMetric(metrics.intensityMinutes, ' 分钟') }}</dd></div>
      <div><dt>平均压力</dt><dd>{{ formatMetric(metrics.averageStressLevel, '') }}</dd></div>
      <div><dt>{{ sleep.label }}</dt><dd>{{ sleep.value }}</dd></div>
    </dl>
  </div>
</template>

<style scoped>
.today-metrics { display: grid; gap: .8rem; }
.today-metrics__progress-card { padding: .8rem .9rem; border-radius: 12px; background: color-mix(in srgb, var(--landing-surface-soft) 72%, transparent); }
.today-metrics__row { display: flex; justify-content: space-between; gap: 1rem; font-size: .9rem; }
.today-metrics__row strong { font-variant-numeric: tabular-nums; }
.today-progress { height: .45rem; margin-top: .6rem; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--landing-muted) 20%, transparent); }
.today-progress span { display: block; height: 100%; border-radius: inherit; background: var(--landing-primary); transition: width 500ms ease; }
.today-progress--battery span { background: #34c759; }
.today-metrics small { display: block; margin-top: .4rem; color: var(--landing-muted); }
.today-metrics__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .6rem; }
.today-metrics__grid div { min-width: 0; padding: .75rem .85rem; border-radius: 12px; background: color-mix(in srgb, var(--landing-surface-soft) 72%, transparent); }
.today-metrics dt { color: var(--landing-muted); font-size: .78rem; }
.today-metrics dd { margin-top: .3rem; font-size: 1rem; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
@media (max-width: 480px) { .today-metrics__grid { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .today-progress span { transition: none; } }
</style>
