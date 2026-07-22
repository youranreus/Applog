<script setup lang="ts">
import { computed } from 'vue';
import { useRequest } from 'alova/client';
import { RouterLink } from 'vue-router';
import { getAnalyticsTrend, getAnalyticsTop } from '@/api/analytics';
import Loading from '@/components/ui/loading/index.vue';
import { Button } from '@/components/ui/button';
import { ROUTE_NAMES } from '@/constants/permission';
import type { IAnalyticsTrendPointDto, IAnalyticsTopItemDto } from '@/types/analytics';

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
 * 文章 Top 10
 */
const {
  loading: postTopLoading,
  data: postTopData,
  error: postTopError,
  send: reloadPostTop,
} = useRequest(() => getAnalyticsTop({ type: 'post', days: 30, limit: 10 }), {
  immediate: true,
});

/**
 * 页面 Top 10
 */
const {
  loading: pageTopLoading,
  data: pageTopData,
  error: pageTopError,
  send: reloadPageTop,
} = useRequest(() => getAnalyticsTop({ type: 'page', days: 30, limit: 10 }), {
  immediate: true,
});

const loading = computed(
  () => trendLoading.value || postTopLoading.value || pageTopLoading.value,
);

const hasError = computed(
  () => !!trendError.value || !!postTopError.value || !!pageTopError.value,
);

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
 * @param key - pv | uv
 * @returns SVG path d 字符串
 */
function buildLinePath(
  points: IAnalyticsTrendPointDto[],
  key: 'pv' | 'uv',
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
      const y =
        CHART_PAD_Y + innerH - (point[key] / maxVal) * innerH;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

const pvPath = computed(() =>
  buildLinePath(trendData.value ?? [], 'pv'),
);

const uvPath = computed(() =>
  buildLinePath(trendData.value ?? [], 'uv'),
);

const trendEmpty = computed(() => {
  const points = trendData.value ?? [];
  if (points.length === 0) {
    return true;
  }
  return points.every((p) => p.pv === 0 && p.uv === 0);
});

/**
 * 重试全部流量详情请求
 */
async function handleRetry(): Promise<void> {
  await Promise.all([reloadTrend(), reloadPostTop(), reloadPageTop()]);
}

/**
 * Top 项公开链接
 * @param item - Top 项
 * @returns 路由 location
 */
function getPublicLink(item: IAnalyticsTopItemDto): { name: string; params: { slug: string } } | null {
  if (!item.slug) {
    return null;
  }
  if (item.contentType === 'post') {
    return { name: ROUTE_NAMES.POST_DETAIL, params: { slug: item.slug } };
  }
  return { name: ROUTE_NAMES.PAGE_DETAIL, params: { slug: item.slug } };
}
</script>

<template>
  <div class="traffic-stats">
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-foreground mb-1">流量详情</h2>
      <p class="text-muted-foreground text-sm">
        近 30 天站点趋势与内容排行（口径含 30 分钟去抖，与「N 次浏览」不同）
      </p>
    </div>

    <div v-if="loading" class="flex justify-center py-16 min-h-[240px]">
      <Loading />
    </div>

    <div v-else-if="hasError" class="text-center text-destructive py-12">
      <p class="mb-4">加载失败，请稍后重试</p>
      <Button variant="outline" @click="handleRetry">
        重试
      </Button>
    </div>

    <div v-else class="traffic-body">
      <section class="traffic-section" aria-labelledby="trend-heading">
        <h3 id="trend-heading" class="section-title">近 30 天趋势</h3>
        <p v-if="trendEmpty" class="empty-hint">暂无流量数据，上线后从今日起累计</p>
        <div v-else class="chart-wrap">
          <svg
            class="trend-chart"
            :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`"
            role="img"
            aria-label="近 30 天 PV 与 UV 趋势折线图"
          >
            <path
              class="trend-line trend-line--pv"
              :d="pvPath"
              fill="none"
            />
            <path
              class="trend-line trend-line--uv"
              :d="uvPath"
              fill="none"
            />
          </svg>
          <ul class="chart-legend" aria-label="图例">
            <li class="legend-item">
              <span class="legend-swatch legend-swatch--pv" aria-hidden="true" />
              PV
            </li>
            <li class="legend-item">
              <span class="legend-swatch legend-swatch--uv" aria-hidden="true" />
              UV
            </li>
          </ul>
        </div>
      </section>

      <section class="traffic-section" aria-labelledby="post-top-heading">
        <h3 id="post-top-heading" class="section-title">文章 Top 10</h3>
        <ul
          v-if="postTopData && postTopData.length > 0"
          class="top-list"
          aria-label="文章流量排行"
        >
          <li v-for="(item, index) in postTopData" :key="item.contentId">
            <RouterLink
              v-if="getPublicLink(item)"
              :to="getPublicLink(item)!"
              class="top-row"
            >
              <span class="top-rank">{{ index + 1 }}</span>
              <span class="top-title">{{ item.title }}</span>
              <span class="top-meta">
                <span class="top-metric">PV {{ item.pv }}</span>
                <span class="top-metric top-metric--muted">UV {{ item.uv }}</span>
              </span>
            </RouterLink>
            <div v-else class="top-row">
              <span class="top-rank">{{ index + 1 }}</span>
              <span class="top-title">{{ item.title }}</span>
              <span class="top-meta">
                <span class="top-metric">PV {{ item.pv }}</span>
                <span class="top-metric top-metric--muted">UV {{ item.uv }}</span>
              </span>
            </div>
          </li>
        </ul>
        <p v-else class="empty-hint">暂无文章流量</p>
      </section>

      <section class="traffic-section" aria-labelledby="page-top-heading">
        <h3 id="page-top-heading" class="section-title">页面 Top 10</h3>
        <ul
          v-if="pageTopData && pageTopData.length > 0"
          class="top-list"
          aria-label="页面流量排行"
        >
          <li v-for="(item, index) in pageTopData" :key="item.contentId">
            <RouterLink
              v-if="getPublicLink(item)"
              :to="getPublicLink(item)!"
              class="top-row"
            >
              <span class="top-rank">{{ index + 1 }}</span>
              <span class="top-title">{{ item.title }}</span>
              <span class="top-meta">
                <span class="top-metric">PV {{ item.pv }}</span>
                <span class="top-metric top-metric--muted">UV {{ item.uv }}</span>
              </span>
            </RouterLink>
            <div v-else class="top-row">
              <span class="top-rank">{{ index + 1 }}</span>
              <span class="top-title">{{ item.title }}</span>
              <span class="top-meta">
                <span class="top-metric">PV {{ item.pv }}</span>
                <span class="top-metric top-metric--muted">UV {{ item.uv }}</span>
              </span>
            </div>
          </li>
        </ul>
        <p v-else class="empty-hint">暂无页面流量</p>
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

.trend-line--pv {
  stroke: var(--color-apple-blue, #0071e3);
}

.trend-line--uv {
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

.legend-swatch--pv {
  background: var(--color-apple-blue, #0071e3);
}

.legend-swatch--uv {
  background: var(--color-carbon, #1d1d1f);
  opacity: 0.55;
}

.top-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.top-row {
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

.top-title {
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

.top-metric {
  font-size: 0.8125rem;
  font-weight: 600;
}

.top-metric--muted {
  font-weight: 400;
  color: var(--muted-foreground);
}

@media (prefers-reduced-motion: reduce) {
  .top-row {
    transition: none;
  }
}
</style>
