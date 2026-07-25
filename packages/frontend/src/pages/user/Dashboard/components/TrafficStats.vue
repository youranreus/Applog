<script setup lang="ts">
import { computed } from 'vue';
import { useRequest } from 'alova/client';
import {
  getAnalyticsTrend,
  getAnalyticsTop,
  getAnalyticsBreakdown,
} from '@/api/analytics';
import Loading from '@/components/ui/loading/index.vue';
import { Button } from '@/components/ui/button';
import type {
  IAnalyticsTrendPointDto,
  IAnalyticsTopItemDto,
  IAnalyticsBreakdownItemDto,
} from '@/types/analytics';

/**
 * 近 30 天趋势
 */
const {
  loading: trendLoading,
  data: trendData,
  error: trendError,
  send: reloadTrend,
} = useRequest(() => getAnalyticsTrend({ days: 30 }), {
  immediate: true,
});

/**
 * 热门页面 Top 10
 */
const {
  loading: topLoading,
  data: topData,
  error: topError,
  send: reloadTop,
} = useRequest(() => getAnalyticsTop({ days: 30, limit: 10 }), {
  immediate: true,
});

/**
 * OS 分布
 */
const {
  loading: osLoading,
  data: osData,
  error: osError,
  send: reloadOs,
} = useRequest(
  () => getAnalyticsBreakdown({ dimension: 'os', days: 30, limit: 10 }),
  { immediate: true },
);

/**
 * 设备分布
 */
const {
  loading: deviceLoading,
  data: deviceData,
  error: deviceError,
  send: reloadDevice,
} = useRequest(
  () => getAnalyticsBreakdown({ dimension: 'device', days: 30, limit: 10 }),
  { immediate: true },
);

/**
 * 地域分布
 */
const {
  loading: countryLoading,
  data: countryData,
  error: countryError,
  send: reloadCountry,
} = useRequest(
  () => getAnalyticsBreakdown({ dimension: 'country', days: 30, limit: 10 }),
  { immediate: true },
);

const loading = computed(
  () =>
    trendLoading.value ||
    topLoading.value ||
    osLoading.value ||
    deviceLoading.value ||
    countryLoading.value,
);

const primaryError = computed(
  () =>
    trendError.value ||
    topError.value ||
    osError.value ||
    deviceError.value ||
    countryError.value,
);

const isNotConfigured = computed(() => {
  const message = primaryError.value?.message ?? '';
  return message.includes('未配置');
});

/**
 * SVG 折线图视口尺寸
 */
const CHART_WIDTH = 640;
const CHART_HEIGHT = 180;
const CHART_PAD_X = 12;
const CHART_PAD_Y = 16;

/**
 * 将趋势点映射为折线 path
 * @param points - 日序列
 * @param key - views | visitors
 * @returns SVG path d 字符串
 */
function buildLinePath(
  points: IAnalyticsTrendPointDto[],
  key: 'views' | 'visitors',
): string {
  if (points.length === 0) {
    return '';
  }

  const values = points.map((p) => p[key]);
  const maxVal = Math.max(...values, 1);
  const innerW = CHART_WIDTH - CHART_PAD_X * 2;
  const innerH = CHART_HEIGHT - CHART_PAD_Y * 2;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  return points
    .map((point, index) => {
      const x = CHART_PAD_X + index * step;
      const y = CHART_PAD_Y + innerH - (point[key] / maxVal) * innerH;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

const viewsPath = computed(() =>
  buildLinePath(trendData.value ?? [], 'views'),
);

const visitorsPath = computed(() =>
  buildLinePath(trendData.value ?? [], 'visitors'),
);

const trendEmpty = computed(() => {
  const points = trendData.value ?? [];
  if (points.length === 0) {
    return true;
  }
  return points.every((p) => p.views === 0 && p.visitors === 0);
});

/**
 * 分布列表是否为空
 * @param rows - 分布数据
 * @returns 是否空
 */
function isBreakdownEmpty(
  rows: IAnalyticsBreakdownItemDto[] | null | undefined,
): boolean {
  return !rows || rows.length === 0;
}

/**
 * 重试全部流量详情请求
 */
async function handleRetry(): Promise<void> {
  await Promise.all([
    reloadTrend(),
    reloadTop(),
    reloadOs(),
    reloadDevice(),
    reloadCountry(),
  ]);
}

/**
 * Top 项前台链接（同源 path）
 * @param item - Top 项
 * @returns href
 */
function getTopHref(item: IAnalyticsTopItemDto): string {
  return item.href || item.path || '/';
}
</script>

<template>
  <div class="traffic-stats">
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-foreground mb-1">流量详情</h2>
      <p class="text-muted-foreground text-sm">
        近 30 天趋势、热门页面与设备 / 地域（来自 Umami；实例与 Geo 由运维侧配置）
      </p>
    </div>

    <div v-if="loading" class="flex justify-center py-16 min-h-[240px]">
      <Loading />
    </div>

    <div v-else-if="primaryError" class="text-center py-12">
      <p
        class="mb-4"
        :class="isNotConfigured ? 'text-muted-foreground' : 'text-destructive'"
      >
        <template v-if="isNotConfigured">
          尚未配置 Umami，请前往「系统设置」填写对接信息后再查看流量。
        </template>
        <template v-else>
          {{ primaryError.message || '加载失败，请稍后重试' }}
        </template>
      </p>
      <Button v-if="!isNotConfigured" variant="outline" @click="handleRetry">
        重试
      </Button>
    </div>

    <div v-else class="traffic-body">
      <section class="traffic-section" aria-labelledby="trend-heading">
        <h3 id="trend-heading" class="section-title">近 30 天趋势</h3>
        <p v-if="trendEmpty" class="empty-hint">暂无流量数据</p>
        <div v-else class="chart-wrap">
          <svg
            class="trend-chart"
            :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`"
            role="img"
            aria-label="近 30 天浏览与访客趋势折线图"
          >
            <path
              class="trend-line trend-line--views"
              :d="viewsPath"
              fill="none"
            />
            <path
              class="trend-line trend-line--visitors"
              :d="visitorsPath"
              fill="none"
            />
          </svg>
          <ul class="chart-legend" aria-label="图例">
            <li class="legend-item">
              <span class="legend-swatch legend-swatch--views" aria-hidden="true" />
              浏览
            </li>
            <li class="legend-item">
              <span class="legend-swatch legend-swatch--visitors" aria-hidden="true" />
              访客
            </li>
          </ul>
        </div>
      </section>

      <section class="traffic-section" aria-labelledby="top-heading">
        <h3 id="top-heading" class="section-title">热门页面 Top 10</h3>
        <ul
          v-if="topData && topData.length > 0"
          class="top-list"
          aria-label="热门页面排行"
        >
          <li v-for="(item, index) in topData" :key="item.path">
            <a :href="getTopHref(item)" class="top-row">
              <span class="top-rank">{{ index + 1 }}</span>
              <span class="top-title" :title="item.path">{{ item.title }}</span>
              <span class="top-meta">
                <span class="top-metric">{{ item.views }}</span>
              </span>
            </a>
          </li>
        </ul>
        <p v-else class="empty-hint">暂无热门页面</p>
      </section>

      <section class="traffic-section" aria-labelledby="os-heading">
        <h3 id="os-heading" class="section-title">操作系统</h3>
        <ul
          v-if="!isBreakdownEmpty(osData)"
          class="breakdown-list"
          aria-label="操作系统分布"
        >
          <li
            v-for="item in osData"
            :key="`os-${item.name}`"
            class="breakdown-row"
          >
            <span class="breakdown-name">{{ item.name }}</span>
            <span class="breakdown-value">{{ item.value }}</span>
          </li>
        </ul>
        <p v-else class="empty-hint">暂无数据</p>
      </section>

      <section class="traffic-section" aria-labelledby="device-heading">
        <h3 id="device-heading" class="section-title">设备</h3>
        <ul
          v-if="!isBreakdownEmpty(deviceData)"
          class="breakdown-list"
          aria-label="设备分布"
        >
          <li
            v-for="item in deviceData"
            :key="`device-${item.name}`"
            class="breakdown-row"
          >
            <span class="breakdown-name">{{ item.name }}</span>
            <span class="breakdown-value">{{ item.value }}</span>
          </li>
        </ul>
        <p v-else class="empty-hint">暂无数据</p>
      </section>

      <section class="traffic-section" aria-labelledby="country-heading">
        <h3 id="country-heading" class="section-title">地理位置</h3>
        <ul
          v-if="!isBreakdownEmpty(countryData)"
          class="breakdown-list"
          aria-label="国家 / 地区分布"
        >
          <li
            v-for="item in countryData"
            :key="`country-${item.name}`"
            class="breakdown-row"
          >
            <span class="breakdown-name">{{ item.name }}</span>
            <span class="breakdown-value">{{ item.value }}</span>
          </li>
        </ul>
        <p v-else class="empty-hint">暂无数据（需在 Umami 侧配置 Geo）</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.traffic-stats {
  width: 100%;
}

.traffic-body {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section-title {
  margin: 0 0 0.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--foreground);
}

.empty-hint {
  margin: 0;
  font-size: 0.875rem;
  color: var(--muted-foreground);
}

.chart-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.trend-chart {
  width: 100%;
  height: auto;
  max-height: 200px;
  display: block;
}

.trend-line {
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.trend-line--views {
  stroke: var(--color-apple-blue, #0071e3);
}

.trend-line--visitors {
  stroke: var(--color-carbon, #1d1d1f);
  stroke-dasharray: 4 4;
  opacity: 0.55;
}

.chart-legend {
  display: flex;
  gap: 1rem;
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.8125rem;
  color: var(--muted-foreground);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.legend-swatch {
  width: 1rem;
  height: 2px;
  border-radius: 1px;
}

.legend-swatch--views {
  background: var(--color-apple-blue, #0071e3);
}

.legend-swatch--visitors {
  background: var(--color-carbon, #1d1d1f);
  opacity: 0.55;
}

.top-list,
.breakdown-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.top-row,
.breakdown-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.5rem;
  margin: 0 -0.5rem;
  border-radius: 10px;
  text-decoration: none;
  color: var(--foreground);
  transition: background-color 0.15s ease-out;
}

a.top-row:hover {
  background-color: var(--color-frost, #f5f5f7);
}

a.top-row:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.top-rank {
  flex-shrink: 0;
  width: 1.5rem;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: var(--muted-foreground);
}

.top-title,
.breakdown-name {
  flex: 1;
  min-width: 0;
  font-size: 0.9375rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-meta {
  display: inline-flex;
  align-items: baseline;
  gap: 0.75rem;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.top-metric,
.breakdown-value {
  font-size: 0.8125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .top-row {
    transition: none;
  }
}
</style>
