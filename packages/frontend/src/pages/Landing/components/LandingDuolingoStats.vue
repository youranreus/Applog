<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { IDuolingoLandingStats } from '@applog/common';
import {
  buildHeatmapCells,
  formatLearningTime,
  formatXp,
  getHeatmapLeadingBlanks,
} from '../duolingo-utils';

const props = defineProps<{
  stats: IDuolingoLandingStats;
}>();

const heatmapScroll = ref<HTMLElement | null>(null);
const cells = computed(() => buildHeatmapCells(props.stats.yearlyXp.days));
const leadingBlanks = computed(() =>
  getHeatmapLeadingBlanks(props.stats.yearlyXp.days[0]?.date ?? ''),
);
const todayKey = computed(
  () =>
    props.stats.last7Days.days[
      props.stats.last7Days.days.length - 1
    ]?.date ?? '',
);
const yearlySummary = computed(() => {
  const elapsed = props.stats.yearlyXp.days.filter((day) => !day.future);
  const activeDays = elapsed.filter((day) => (day.xp ?? 0) > 0).length;
  const totalXp = elapsed.reduce((sum, day) => sum + (day.xp ?? 0), 0);
  return `${props.stats.yearlyXp.year} 年已有 ${activeDays} 个学习日，累计 ${formatXp(totalXp)} XP`;
});
const fetchedAtText = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(props.stats.fetchedAt)),
);

async function scrollToCurrentWeek(): Promise<void> {
  await nextTick();
  const today = heatmapScroll.value?.querySelector<HTMLElement>(
    `[data-date="${todayKey.value}"]`,
  );
  today?.scrollIntoView({ block: 'nearest', inline: 'end' });
}

watch(() => props.stats.fetchedAt, scrollToCurrentWeek, { immediate: true });
</script>

<template>
  <section class="duolingo-stats" aria-labelledby="duolingo-stats-title">
    <header class="duolingo-stats__header">
      <div>
        <p class="duolingo-stats__eyebrow">学习轨迹</p>
        <h2 id="duolingo-stats-title">最近在多邻国学习</h2>
      </div>
      <p v-if="stats.stale" class="duolingo-stats__stale" role="status">
        最近一次数据更新于 {{ fetchedAtText }}
      </p>
    </header>

    <dl class="duolingo-stats__metrics">
      <div>
        <dt>当前连胜</dt>
        <dd>{{ stats.streakDays === null ? '暂无数据' : `${stats.streakDays} 天` }}</dd>
      </div>
      <div>
        <dt>当前联赛</dt>
        <dd>{{ stats.league?.name ?? '暂无可靠数据' }}</dd>
      </div>
      <div>
        <dt>近 7 日经验</dt>
        <dd>{{ formatXp(stats.last7Days.totalXp) }} XP</dd>
      </div>
      <div>
        <dt>近 7 日学习时间</dt>
        <dd>{{ formatLearningTime(stats.last7Days.totalLearningSeconds) }}</dd>
      </div>
    </dl>

    <div v-if="stats.languages.length" class="duolingo-stats__languages">
      <article v-for="language in stats.languages" :key="language.code">
        <div>
          <h3>{{ language.name }}</h3>
          <p>{{ formatXp(language.xp) }} XP</p>
        </div>
        <strong>{{ Math.round(language.share * 100) }}%</strong>
      </article>
    </div>

    <div class="duolingo-stats__year">
      <div class="duolingo-stats__year-header">
        <h3>{{ stats.yearlyXp.year }} 年学习节奏</h3>
        <p>{{ yearlySummary }}</p>
      </div>
      <div class="heatmap-layout">
        <div class="heatmap-weekdays" aria-hidden="true">
          <span>日</span><span>一</span><span>二</span><span>三</span>
          <span>四</span><span>五</span><span>六</span>
        </div>
        <div ref="heatmapScroll" class="heatmap-scroll" tabindex="0">
          <div
            class="heatmap"
            role="group"
            :aria-label="yearlySummary"
          >
            <span
              v-for="blank in leadingBlanks"
              :key="`blank-${blank}`"
              class="heatmap__blank"
              aria-hidden="true"
            />
            <span
              v-for="cell in cells"
              :key="cell.date"
              class="heatmap__cell"
              :class="[
                `heatmap__cell--${cell.intensity}`,
                { 'heatmap__cell--future': cell.future },
              ]"
              :data-date="cell.date"
              :title="cell.label"
              role="img"
              :aria-label="cell.label"
            />
          </div>
        </div>
      </div>
      <div class="heatmap-legend" aria-label="热力图图例">
        <span>较少</span>
        <i class="heatmap__cell heatmap__cell--0" role="img" aria-label="0 XP" />
        <i class="heatmap__cell heatmap__cell--1" role="img" aria-label="低强度" />
        <i class="heatmap__cell heatmap__cell--2" role="img" aria-label="中低强度" />
        <i class="heatmap__cell heatmap__cell--3" role="img" aria-label="中高强度" />
        <i class="heatmap__cell heatmap__cell--4" role="img" aria-label="高强度" />
        <span>较多</span>
      </div>
    </div>

    <p class="duolingo-stats__disclaimer">
      个人学习数据展示，与 Duolingo Inc. 无官方关联。
    </p>
  </section>
</template>

<style scoped>
.duolingo-stats {
  min-width: 0;
  padding-top: clamp(4.5rem, 10vw, 6.5rem);
}

.duolingo-stats__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
}

.duolingo-stats__eyebrow {
  margin-bottom: 0.35rem;
  color: var(--landing-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.duolingo-stats h2 {
  color: var(--landing-text);
  font-family: var(--landing-font-heading);
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.18;
}

.duolingo-stats__stale,
.duolingo-stats__year-header p,
.duolingo-stats__disclaimer {
  color: var(--landing-muted);
  font-size: 0.75rem;
  line-height: 1.5;
}

.duolingo-stats__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 1.5rem;
  border-block: 1px solid var(--color-pebble);
}

.duolingo-stats__metrics > div {
  min-width: 0;
  padding: 1.25rem;
  border-left: 1px solid var(--color-pebble);
}

.duolingo-stats__metrics > div:first-child {
  border-left: 0;
  padding-left: 0;
}

.duolingo-stats__metrics dt {
  color: var(--landing-muted);
  font-size: 0.75rem;
}

.duolingo-stats__metrics dd {
  margin-top: 0.4rem;
  color: var(--landing-text);
  font-size: clamp(1rem, 0.92rem + 0.25vw, 1.125rem);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.duolingo-stats__languages {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 1rem;
}

.duolingo-stats__languages article {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.125rem;
  border-radius: 8px;
  background: var(--landing-surface);
}

.duolingo-stats__languages h3 {
  color: var(--landing-text);
  font-size: 0.9375rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.duolingo-stats__languages p {
  margin-top: 0.2rem;
  color: var(--landing-muted);
  font-size: 0.75rem;
}

.duolingo-stats__languages strong {
  color: var(--landing-link);
  font-size: 1.125rem;
}

.duolingo-stats__year {
  margin-top: 2rem;
}

.duolingo-stats__year-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.duolingo-stats__year-header h3 {
  color: var(--landing-text);
  font-size: 0.9375rem;
  font-weight: 600;
}

.heatmap-layout {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.heatmap-weekdays {
  display: grid;
  grid-template-rows: repeat(7, 11px);
  gap: 3px;
  color: var(--landing-muted);
  font-size: 0.5625rem;
  line-height: 11px;
}

.heatmap-scroll {
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: thin;
}

.heatmap-scroll:focus-visible {
  outline: 2px solid var(--landing-primary);
  outline-offset: 3px;
}

.heatmap {
  display: grid;
  width: max-content;
  grid-template-rows: repeat(7, 11px);
  grid-auto-columns: 11px;
  grid-auto-flow: column;
  gap: 3px;
}

.heatmap__cell,
.heatmap__blank {
  display: block;
  width: 11px;
  height: 11px;
  border-radius: 2px;
}

.heatmap__cell--0 { background: var(--color-pebble); }
.heatmap__cell--1 { background: #c8e6cc; }
.heatmap__cell--2 { background: #91cc98; }
.heatmap__cell--3 { background: #50aa62; }
.heatmap__cell--4 { background: #24883d; }
.heatmap__cell--future {
  background: transparent;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-pebble) 70%, transparent);
}

.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 0.75rem;
  color: var(--landing-muted);
  font-size: 0.625rem;
}

.heatmap-legend i {
  flex: none;
}

.duolingo-stats__disclaimer {
  margin-top: 1rem;
}

@media (max-width: 640px) {
  .duolingo-stats__header,
  .duolingo-stats__year-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.5rem;
  }

  .duolingo-stats__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .duolingo-stats__metrics > div:nth-child(3) {
    border-left: 0;
    padding-left: 0;
    border-top: 1px solid var(--color-pebble);
  }

  .duolingo-stats__metrics > div:nth-child(4) {
    border-top: 1px solid var(--color-pebble);
  }

  .duolingo-stats__languages {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .heatmap-scroll {
    scroll-behavior: auto;
  }
}
</style>
