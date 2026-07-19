<script setup lang="ts">
import { useRequest } from 'alova/client';
import { RouterLink } from 'vue-router';
import { getUserOverview } from '@/api/user';
import Loading from '@/components/ui/loading/index.vue';
import { Button } from '@/components/ui/button';
import { ROUTE_NAMES } from '@/constants/permission';
import { ChevronRightIcon } from '@lucide/vue';

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
 * 重新加载概览数据
 */
async function handleRetry(): Promise<void> {
  await reloadOverview();
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

    <div v-if="loading" class="flex justify-center py-16 min-h-[240px]">
      <Loading />
    </div>

    <div v-else-if="error" class="text-center text-destructive py-12">
      <p class="mb-4">加载失败，请稍后重试</p>
      <Button variant="outline" @click="handleRetry">
        重试
      </Button>
    </div>

    <ul
      v-else-if="overviewData"
      class="stat-list"
      aria-label="创作数据统计"
    >
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

@media (prefers-reduced-motion: reduce) {
  .stat-row {
    transition: none;
  }
}
</style>
