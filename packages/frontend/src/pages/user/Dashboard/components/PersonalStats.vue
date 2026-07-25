<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRequest } from 'alova/client';
import { RouterLink } from 'vue-router';
import { getUserOverview } from '@/api/user';
import { getAnalyticsSummary } from '@/api/analytics';
import { useUserStore } from '@/stores/useUserStore';
import Loading from '@/components/ui/loading/index.vue';
import { Button } from '@/components/ui/button';
import { ROUTE_NAMES, USER_ROLES } from '@/constants/permission';
import { ChevronRightIcon } from '@lucide/vue';

/**
 * 用户 Store：判断是否管理员（仅 admin 展示流量摘要）
 */
const userStore = useUserStore();

/**
 * 当前用户是否为管理员
 */
const isAdmin = computed(() => userStore.user?.role === USER_ROLES.ADMIN);

/**
 * 使用 alova 的 useRequest 获取用户创作概览信息
 * 接口路径: GET /user/overview
 */
const {
  loading,
  data: overviewData,
  error,
  send: reloadOverview,
} = useRequest(getUserOverview, {
  immediate: true,
});

/**
 * 管理员流量摘要（按 isAdmin 触发，非 admin 不请求）
 */
const {
  loading: summaryLoading,
  data: summaryData,
  error: summaryError,
  send: reloadSummary,
} = useRequest(getAnalyticsSummary, {
  immediate: false,
});

/**
 * 管理员进入时拉取流量摘要
 */
watch(
  isAdmin,
  (admin) => {
    if (admin) {
      void reloadSummary();
    }
  },
  { immediate: true },
);

/**
 * 统计行配置：标签、数值字段、跳转路由
 */
interface IStatRow {
  key: string;
  label: string;
  getValue: () => number;
  routeName: string;
}

/**
 * 工具感列表行（无彩虹图标、无等权卡片墙）
 */
const statRows: IStatRow[] = [
  {
    key: 'posts',
    label: '文章',
    getValue: () => overviewData.value?.postCount ?? 0,
    routeName: ROUTE_NAMES.USER_POST_LIST,
  },
  {
    key: 'pages',
    label: '页面',
    getValue: () => overviewData.value?.pageCount ?? 0,
    routeName: ROUTE_NAMES.USER_PAGE_LIST,
  },
  {
    key: 'comments',
    label: '发表评论',
    getValue: () => overviewData.value?.commentCount ?? 0,
    routeName: ROUTE_NAMES.USER_COMMENT_LIST,
  },
  {
    key: 'received',
    label: '收到评论',
    getValue: () => overviewData.value?.receivedCommentCount ?? 0,
    routeName: ROUTE_NAMES.USER_COMMENT_LIST,
  },
];

/**
 * 流量摘要行（无跳转，纯展示）
 */
interface ITrafficRow {
  key: string;
  label: string;
  getValue: () => number;
}

const trafficRows: ITrafficRow[] = [
  {
    key: 'todayViews',
    label: '今日浏览',
    getValue: () => summaryData.value?.todayViews ?? 0,
  },
  {
    key: 'todayVisitors',
    label: '今日访客',
    getValue: () => summaryData.value?.todayVisitors ?? 0,
  },
  {
    key: 'last7Views',
    label: '近 7 日浏览',
    getValue: () => summaryData.value?.last7DaysViews ?? 0,
  },
  {
    key: 'last7Visitors',
    label: '近 7 日访客',
    getValue: () => summaryData.value?.last7DaysVisitors ?? 0,
  },
];

/**
 * 流量错误是否为「未配置」
 */
const isSummaryNotConfigured = computed(() => {
  const message = summaryError.value?.message ?? '';
  return message.includes('未配置');
});

/**
 * 重新加载概览与流量摘要
 */
async function handleRetry(): Promise<void> {
  await reloadOverview();
  if (isAdmin.value) {
    await reloadSummary();
  }
}
</script>

<template>
  <div class="personal-stats">
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-foreground mb-1">个人统计</h2>
      <p class="text-muted-foreground text-sm">
        创作概览，点击可进入对应管理列表
      </p>
    </div>

    <div
      v-if="loading || (isAdmin && summaryLoading)"
      class="flex justify-center py-16 min-h-[240px]"
    >
      <Loading />
    </div>

    <div v-else-if="error" class="text-center text-destructive py-12">
      <p class="mb-4">加载失败，请稍后重试</p>
      <Button variant="outline" @click="handleRetry">
        重试
      </Button>
    </div>

    <template v-else-if="overviewData">
      <ul class="stat-list" aria-label="创作数据统计">
        <li v-for="row in statRows" :key="row.key">
          <RouterLink
            :to="{ name: row.routeName }"
            class="stat-row"
          >
            <span class="stat-label">{{ row.label }}</span>
            <span class="stat-meta">
              <span class="stat-value">{{ row.getValue() }}</span>
              <ChevronRightIcon class="stat-chevron" aria-hidden="true" />
            </span>
          </RouterLink>
        </li>
      </ul>

      <template v-if="isAdmin">
        <div class="traffic-summary-header">
          <h3 class="traffic-summary-title">站点流量</h3>
          <p class="traffic-summary-desc">
            今日与近 7 日浏览 / 访客（来自 Umami，与「N 次浏览」口径不同）
          </p>
        </div>

        <div
          v-if="summaryError"
          class="text-sm text-muted-foreground mb-2"
        >
          <template v-if="isSummaryNotConfigured">
            尚未配置 Umami，请前往
            <span class="text-link-blue">系统设置</span>
            填写对接信息。
          </template>
          <template v-else>
            <span class="text-destructive">
              {{ summaryError.message || '流量摘要加载失败' }}，
            </span>
            <button type="button" class="retry-inline" @click="reloadSummary">
              重试
            </button>
          </template>
        </div>

        <ul
          v-else
          class="stat-list"
          aria-label="站点流量摘要"
        >
          <li v-for="row in trafficRows" :key="row.key" class="stat-row stat-row--static">
            <span class="stat-label">{{ row.label }}</span>
            <span class="stat-meta">
              <span class="stat-value">{{ row.getValue() }}</span>
            </span>
          </li>
        </ul>
      </template>
    </template>

    <div v-else class="text-center text-muted-foreground py-12">
      <p>暂无统计数据</p>
    </div>
  </div>
</template>

<style scoped>
.personal-stats {
  width: 100%;
}

.stat-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.5rem;
  margin: 0 -0.5rem;
  border-radius: 10px;
  text-decoration: none;
  color: var(--foreground);
  transition: background-color 0.15s ease-out;
}

.stat-row:hover {
  background-color: var(--color-frost, #f5f5f7);
}

.stat-row--static {
  cursor: default;
}

.stat-row--static:hover {
  background-color: transparent;
}

.stat-row:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.stat-label {
  font-size: 0.9375rem;
  font-weight: 400;
}

.stat-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stat-chevron {
  width: 1rem;
  height: 1rem;
  color: var(--muted-foreground);
}

.traffic-summary-header {
  margin-top: 2rem;
  margin-bottom: 0.75rem;
}

.traffic-summary-title {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--foreground);
}

.traffic-summary-desc {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--muted-foreground);
}

.retry-inline {
  padding: 0;
  border: none;
  background: none;
  color: var(--color-link-blue, #0066cc);
  cursor: pointer;
  text-decoration: underline;
  font-size: inherit;
}

.text-link-blue {
  color: var(--color-link-blue, #0066cc);
}

@media (prefers-reduced-motion: reduce) {
  .stat-row {
    transition: none;
  }
}
</style>
