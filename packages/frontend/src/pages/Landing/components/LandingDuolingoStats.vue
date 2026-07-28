<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { IDuolingoLandingStats } from '@applog/common';
import {
  buildHeatmapCells,
  formatLearningTime,
  formatXp,
  getHeatmapLeadingBlanks,
} from '../duolingo-utils';

/** 指标卡片色盘轮转 tone（与样式 nth / class 对应） */
type MetricTone = 'green' | 'blue' | 'ink' | 'leaf';

interface IMetricCard {
  label: string;
  value: string;
  tone: MetricTone;
}

const props = withDefaults(
  defineProps<{
    stats?: IDuolingoLandingStats | null;
    loading?: boolean;
  }>(),
  {
    stats: null,
    loading: false,
  },
);

const heatmapScroll = ref<HTMLElement | null>(null);
const cells = computed(() =>
  props.stats ? buildHeatmapCells(props.stats.yearlyXp.days) : [],
);
const leadingBlanks = computed(() =>
  getHeatmapLeadingBlanks(props.stats?.yearlyXp.days[0]?.date ?? ''),
);

/**
 * 热力图周列数，供 CSS 按容器宽度均分格子。
 * @returns 至少 1 列
 */
const heatmapWeekCount = computed(() =>
  Math.max(
    1,
    Math.ceil((leadingBlanks.value.length + cells.value.length) / 7),
  ),
);

const todayKey = computed(
  () =>
    props.stats?.last7Days.days[
      props.stats.last7Days.days.length - 1
    ]?.date ?? '',
);

/**
 * 组装顶部四张指标卡片（含色盘 tone）。
 * @returns 指标卡片列表；无数据时为空数组
 */
const metricCards = computed((): IMetricCard[] => {
  if (!props.stats) return [];
  return [
    {
      label: '当前连胜',
      value:
        props.stats.streakDays === null
          ? '暂无数据'
          : `${props.stats.streakDays} 天`,
      tone: 'green',
    },
    {
      label: '当前联赛',
      value: props.stats.league?.name ?? '暂无可靠数据',
      tone: 'blue',
    },
    {
      label: '近 7 日经验',
      value: `${formatXp(props.stats.last7Days.totalXp)} XP`,
      tone: 'ink',
    },
    {
      label: '近 7 日学习时间',
      value: formatLearningTime(props.stats.last7Days.totalLearningSeconds),
      tone: 'leaf',
    },
  ];
});

const yearlySummary = computed(() => {
  if (!props.stats) return '';
  const elapsed = props.stats.yearlyXp.days.filter((day) => !day.future);
  const activeDays = elapsed.filter((day) => (day.xp ?? 0) > 0).length;
  const totalXp = elapsed.reduce((sum, day) => sum + (day.xp ?? 0), 0);
  return `${props.stats.yearlyXp.year} 年已有 ${activeDays} 个学习日，累计 ${formatXp(totalXp)} XP`;
});

const fetchedAtText = computed(() => {
  if (!props.stats) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(props.stats.fetchedAt));
});

/** 骨架态按全年约 53 周铺满宽度 */
const SKELETON_WEEK_COUNT = 53;
const skeletonHeatmapCells = Array.from(
  { length: SKELETON_WEEK_COUNT * 7 },
  (_, index) => index,
);
const skeletonMetricTones: MetricTone[] = ['green', 'blue', 'ink', 'leaf'];

/**
 * 热力图滚动到当前周附近，避免极窄屏溢出时默认停在年初。
 * @returns Promise，等待 DOM 更新完成
 */
async function scrollToCurrentWeek(): Promise<void> {
  await nextTick();
  const today = heatmapScroll.value?.querySelector<HTMLElement>(
    `[data-date="${todayKey.value}"]`,
  );
  today?.scrollIntoView({ block: 'nearest', inline: 'end' });
}

watch(
  () => props.stats?.fetchedAt,
  (fetchedAt) => {
    if (fetchedAt) void scrollToCurrentWeek();
  },
  { immediate: true },
);
</script>

<template>
  <section
    v-if="loading"
    class="duolingo-stats"
    aria-busy="true"
    aria-labelledby="duolingo-stats-title"
  >
    <header class="duolingo-stats__header">
      <div>
        <p class="duolingo-stats__eyebrow">学习轨迹</p>
        <h2 id="duolingo-stats-title">最近在多邻国学习</h2>
      </div>
    </header>

    <p class="sr-only" aria-live="polite">正在加载学习数据</p>

    <dl class="duolingo-stats__metrics" aria-hidden="true">
      <div
        v-for="(tone, index) in skeletonMetricTones"
        :key="`metric-${index}`"
        class="duolingo-stats__metric"
        :class="`duolingo-stats__metric--${tone}`"
      >
        <dt><span class="duolingo-skeleton duolingo-skeleton--label" /></dt>
        <dd><span class="duolingo-skeleton duolingo-skeleton--value" /></dd>
      </div>
    </dl>

    <div class="duolingo-stats__languages" aria-hidden="true">
      <article v-for="card in 2" :key="`lang-${card}`">
        <div>
          <span class="duolingo-skeleton duolingo-skeleton--lang-title" />
          <span class="duolingo-skeleton duolingo-skeleton--lang-meta" />
        </div>
        <span class="duolingo-skeleton duolingo-skeleton--lang-share" />
      </article>
    </div>

    <div class="duolingo-stats__year" aria-hidden="true">
      <div class="duolingo-stats__year-header">
        <span class="duolingo-skeleton duolingo-skeleton--year-title" />
        <span class="duolingo-skeleton duolingo-skeleton--year-summary" />
      </div>
      <div
        class="heatmap-layout"
        :style="{ '--heatmap-weeks': String(SKELETON_WEEK_COUNT) }"
      >
        <div class="heatmap-weekdays">
          <span>日</span><span>一</span><span>二</span><span>三</span>
          <span>四</span><span>五</span><span>六</span>
        </div>
        <div class="heatmap-scroll">
          <div class="heatmap">
            <span
              v-for="cell in skeletonHeatmapCells"
              :key="`heat-${cell}`"
              class="heatmap__cell heatmap__cell--skeleton"
            />
          </div>
        </div>
      </div>
    </div>
  </section>

  <section
    v-else-if="stats"
    class="duolingo-stats"
    aria-labelledby="duolingo-stats-title"
  >
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
      <div
        v-for="metric in metricCards"
        :key="metric.label"
        class="duolingo-stats__metric"
        :class="`duolingo-stats__metric--${metric.tone}`"
      >
        <dt>{{ metric.label }}</dt>
        <dd>{{ metric.value }}</dd>
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
      <div
        class="heatmap-layout"
        :style="{ '--heatmap-weeks': String(heatmapWeekCount) }"
      >
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
  /* Duolingo section palette — local to this surface */
  --color-eager-green: #58cc02;
  --color-storybook-green: #d7ffb8;
  --color-spark-blue: #1cb0f6;
  --color-fresh-leaf: #a5ed6e;
  --color-night-ink: #000437;
  --color-paper-white: #ffffff;
  --color-charcoal: #4b4b4b;
  --color-pencil-gray: #777777;
  --color-faded-gray: #afafaf;

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
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.duolingo-stats__metric {
  min-width: 0;
  padding: 1.125rem 1.25rem;
  border-radius: 16px;
  background: var(--metric-wash);
  color: var(--metric-value);
}

.duolingo-stats__metric dt {
  color: var(--metric-label);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.3;
}

.duolingo-stats__metric dd {
  margin-top: 0.45rem;
  color: var(--metric-value);
  font-size: clamp(1.05rem, 0.95rem + 0.35vw, 1.25rem);
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.duolingo-stats__metric--green {
  --metric-wash: var(--color-eager-green);
  --metric-value: var(--color-paper-white);
  --metric-label: color-mix(in srgb, var(--color-paper-white) 82%, var(--color-storybook-green));
}

.duolingo-stats__metric--blue {
  --metric-wash: var(--color-spark-blue);
  --metric-value: var(--color-paper-white);
  --metric-label: color-mix(in srgb, var(--color-paper-white) 82%, #b8e8fc);
}

.duolingo-stats__metric--ink {
  --metric-wash: var(--color-night-ink);
  --metric-value: var(--color-paper-white);
  --metric-label: color-mix(in srgb, var(--color-paper-white) 72%, var(--color-spark-blue));
}

.duolingo-stats__metric--leaf {
  --metric-wash: var(--color-fresh-leaf);
  --metric-value: var(--color-night-ink);
  --metric-label: var(--color-charcoal);
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
  color: var(--color-eager-green);
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
  --heatmap-gap: 3px;
  --heatmap-weekday-w: 1rem;
  --heatmap-layout-gap: 0.5rem;
  --heatmap-weeks: 53;
  /* cqi 相对本栏宽度，避免自定义属性里的 100% 解析到热力图自身造成循环/铺不满 */
  --heatmap-cell: max(
    8px,
    calc(
      (
          100cqi - var(--heatmap-weekday-w) - var(--heatmap-layout-gap) -
            (var(--heatmap-weeks) - 1) * var(--heatmap-gap)
        ) / var(--heatmap-weeks)
    )
  );

  container-type: inline-size;
  display: grid;
  grid-template-columns: var(--heatmap-weekday-w) minmax(0, 1fr);
  gap: var(--heatmap-layout-gap);
  width: 100%;
  margin-top: 0.75rem;
}

.heatmap-weekdays {
  display: grid;
  grid-template-rows: repeat(7, var(--heatmap-cell));
  gap: var(--heatmap-gap);
  color: var(--color-pencil-gray);
  font-size: 0.5625rem;
  line-height: var(--heatmap-cell);
}

.heatmap-scroll {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: thin;
}

.heatmap-scroll:focus-visible {
  outline: 2px solid var(--color-spark-blue);
  outline-offset: 3px;
}

.heatmap {
  /* 列宽按栏宽反算格子边长，总宽刚好铺满；过窄触底 8px 时再横向滚动 */
  display: grid;
  width: max-content;
  max-width: none;
  grid-template-columns: repeat(var(--heatmap-weeks), var(--heatmap-cell));
  grid-template-rows: repeat(7, var(--heatmap-cell));
  grid-auto-flow: column;
  column-gap: var(--heatmap-gap);
  row-gap: var(--heatmap-gap);
}

.heatmap__cell,
.heatmap__blank {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  border-radius: 2px;
}

.heatmap__cell--0 { background: color-mix(in srgb, var(--color-faded-gray) 35%, var(--color-paper-white)); }
.heatmap__cell--1 { background: var(--color-storybook-green); }
.heatmap__cell--2 { background: var(--color-fresh-leaf); }
.heatmap__cell--3 { background: var(--color-eager-green); }
.heatmap__cell--4 { background: color-mix(in srgb, var(--color-eager-green) 72%, var(--color-night-ink)); }
.heatmap__cell--future {
  background: transparent;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-faded-gray) 55%, transparent);
}

.heatmap__cell--skeleton {
  background: color-mix(in srgb, var(--color-faded-gray) 28%, var(--color-paper-white));
}

.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 0.75rem;
  color: var(--color-pencil-gray);
  font-size: 0.625rem;
}

.heatmap-legend .heatmap__cell {
  flex: none;
  width: 11px;
  height: 11px;
}

.heatmap-legend i {
  flex: none;
}

.duolingo-stats__disclaimer {
  margin-top: 1rem;
}

.duolingo-skeleton {
  display: block;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, currentColor 18%, transparent) 25%,
    color-mix(in srgb, currentColor 32%, transparent) 50%,
    color-mix(in srgb, currentColor 18%, transparent) 75%
  );
  background-size: 200% 100%;
  animation: duolingo-skeleton-shimmer 1.6s ease-in-out infinite;
}

.duolingo-stats__metric--green .duolingo-skeleton,
.duolingo-stats__metric--blue .duolingo-skeleton,
.duolingo-stats__metric--ink .duolingo-skeleton {
  color: var(--color-paper-white);
}

.duolingo-stats__metric--leaf .duolingo-skeleton {
  color: var(--color-night-ink);
}

.duolingo-skeleton--label {
  width: 3.5rem;
  height: 0.75rem;
}

.duolingo-skeleton--value {
  width: 4.5rem;
  height: 1.125rem;
  margin-top: 0.4rem;
}

.duolingo-skeleton--lang-title {
  width: 4rem;
  height: 0.9375rem;
}

.duolingo-skeleton--lang-meta {
  width: 3.25rem;
  height: 0.75rem;
  margin-top: 0.35rem;
}

.duolingo-skeleton--lang-share {
  width: 2.25rem;
  height: 1.125rem;
}

.duolingo-skeleton--year-title {
  width: 7rem;
  height: 0.9375rem;
}

.duolingo-skeleton--year-summary {
  width: min(14rem, 55%);
  height: 0.75rem;
}

@keyframes duolingo-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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
    gap: 0.5rem;
  }

  .duolingo-stats__languages {
    grid-template-columns: 1fr;
  }

  .duolingo-skeleton--year-summary {
    width: 10rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .heatmap-scroll {
    scroll-behavior: auto;
  }

  .duolingo-skeleton {
    animation: none;
    background: color-mix(in srgb, currentColor 22%, transparent);
  }
}
</style>
