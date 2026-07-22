<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSystemStore } from '@/stores/useSystemStore';
import { useUserStore } from '@/stores/useUserStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useSystemInitialize } from './hooks/useSystemInitialize';
import SystemInitialize from './components/SystemInitialize.vue';
import PersonalStats from './components/PersonalStats.vue';
import SystemSettings from './components/SystemSettings.vue';
import TrafficStats from './components/TrafficStats.vue';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { USER_ROLES } from '@/constants/permission';

/**
 * Tab 类型定义
 */
type TabType = 'stats' | 'settings' | 'traffic';

/**
 * 使用系统配置 Store 获取配置状态
 */
const systemStore = useSystemStore();

/**
 * 使用用户 Store 获取用户信息
 */
const userStore = useUserStore();

/**
 * 布局 Store：通知反馈
 */
const layoutStore = useLayoutStore();

/**
 * 是否管理员（流量相关 UI 仅 admin）
 */
const isAdmin = computed(() => userStore.user?.role === USER_ROLES.ADMIN);

/**
 * 使用系统初始化 Hook 处理初始化逻辑
 */
const {
  loading: initLoading,
  error: initError,
  handleInitialize,
  getErrorMessage,
} = useSystemInitialize(async () => {
  await systemStore.refreshConfig();
});

/**
 * 初始化失败时的内联错误文案
 */
const initErrorMessage = computed(() => {
  if (!initError.value) {
    return null;
  }
  return getErrorMessage(initError.value);
});

/**
 * 判断是否显示初始化按钮
 * 当配置为空或请求失败时返回 true
 */
const showInitializeButton = computed(() => {
  if (systemStore.loading) {
    return false;
  }

  return !systemStore.config || !!systemStore.error;
});

/**
 * 当前选中的 tab
 */
const activeTab = ref<TabType>('stats');

/**
 * Tab 配置列表（管理员额外展示「流量详情」）
 */
const tabs = computed(() => {
  const base: { key: TabType; label: string }[] = [
    { key: 'stats', label: '个人统计' },
    { key: 'settings', label: '系统设置' },
  ];
  if (isAdmin.value) {
    base.splice(1, 0, { key: 'traffic', label: '流量详情' });
  }
  return base;
});

/**
 * 处理系统初始化：成功/失败均给出可见反馈
 */
async function onInitialize(): Promise<void> {
  try {
    await handleInitialize();
    layoutStore.notify({
      title: '初始化成功',
      content: '系统配置已就绪，可以开始管理站点',
      type: 'success',
    });
  } catch (error) {
    layoutStore.notify({
      title: '初始化失败',
      content: getErrorMessage(error),
      type: 'error',
    });
  }
}
</script>

<template>
  <div class="dashboard-page admin-page-container">
    <header class="page-header">
      <h1 class="page-title">
        <span class="page-title__text">概览</span>
        <svg
          class="page-title__wave"
          viewBox="0 0 48 12"
          preserveAspectRatio="xMinYMid meet"
          aria-hidden="true"
        >
          <path
            d="M3 7 C 12 2.5, 18 2.5, 24 7 S 36 11.5, 45 7"
            fill="none"
            stroke="currentColor"
            stroke-width="2.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </h1>
    </header>

    <div class="dashboard-content">
      <SystemInitialize
        v-if="showInitializeButton"
        :loading="initLoading"
        :error-message="initErrorMessage"
        @initialize="onInitialize"
      />

      <div v-else class="dashboard-main">
        <div class="dashboard-layout">
          <aside class="dashboard-sidebar">
            <div class="user-info-card">
              <div class="user-avatar-wrapper">
                <img
                  v-if="userStore.user?.avatar"
                  :src="userStore.user.avatar"
                  :alt="userStore.user?.name || '用户头像'"
                  class="user-avatar"
                />
                <div
                  v-else
                  class="user-avatar user-avatar-fallback"
                  aria-hidden="true"
                >
                  {{ (userStore.user?.name || '?').slice(0, 1) }}
                </div>
              </div>
              <h2 class="user-name">{{ userStore.user?.name || '未登录' }}</h2>
              <p class="user-email">{{ userStore.user?.email || '' }}</p>
            </div>

            <Tabs
              v-model="activeTab"
              orientation="vertical"
              class="dashboard-segment w-full"
            >
              <TabsList
                variant="default"
                class="dashboard-segment__list"
              >
                <TabsTrigger
                  v-for="tab in tabs"
                  :key="tab.key"
                  :value="tab.key"
                  class="dashboard-segment__trigger"
                >
                  {{ tab.label }}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </aside>

          <main class="dashboard-content-area">
            <PersonalStats v-if="activeTab === 'stats'" />
            <TrafficStats v-else-if="activeTab === 'traffic' && isAdmin" />
            <SystemSettings v-else-if="activeTab === 'settings'" />
          </main>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  width: 100%;
}

.page-header {
  margin-bottom: 2.5rem;
}

.page-title {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  margin: 0;
  padding-bottom: 2px;
  overflow: visible;
  font-family: var(--font-heading, inherit);
  font-size: clamp(1.75rem, 1.4rem + 1.2vw, 2.25rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--color-carbon, #1d1d1f);
  text-wrap: balance;
}

.page-title__text {
  display: block;
}

.page-title__wave {
  display: block;
  width: 2.1em;
  height: 12px;
  margin-top: 2px;
  overflow: visible;
  color: var(--color-signal-blue, #2997ff);
  opacity: 0.65;
  pointer-events: none;
}

.dashboard-content {
  margin-top: 0;
}

.dashboard-main {
  width: 100%;
}

.dashboard-layout {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.dashboard-sidebar {
  flex-shrink: 0;
  width: 280px;
}

.user-info-card {
  margin-bottom: 1.5rem;
}

.user-avatar-wrapper {
  display: flex;
  margin-bottom: 1rem;
}

.user-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
}

.user-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1;
}

.user-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--foreground);
}

.user-email {
  font-size: 0.875rem;
  color: var(--muted-foreground);
}

/**
 * Apple 色块按钮式分段切换
 * 选中：Apple Blue 填充胶囊；未选中：Frost 色块
 */
.dashboard-segment :deep(.dashboard-segment__list) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  height: auto;
  padding: 0;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

.dashboard-segment :deep(.dashboard-segment__trigger) {
  width: 100%;
  height: auto;
  min-height: 40px;
  justify-content: flex-start;
  padding: 10px 16px;
  border-radius: 10px;
  border: none;
  background: var(--color-frost, #f5f5f7);
  color: var(--color-carbon, #1d1d1f);
  font-size: 15px;
  font-weight: 400;
  letter-spacing: -0.01em;
  text-align: left;
  box-shadow: none;
  transition:
    background-color 0.18s ease-out,
    color 0.18s ease-out,
    transform 0.12s ease-out;
}

.dashboard-segment :deep(.dashboard-segment__trigger::after) {
  display: none;
}

.dashboard-segment :deep(.dashboard-segment__trigger:hover) {
  background: var(--color-pebble, #e2e2e5);
  color: var(--color-carbon, #1d1d1f);
}

.dashboard-segment :deep(.dashboard-segment__trigger[data-state='active']),
.dashboard-segment :deep(.dashboard-segment__trigger[aria-selected='true']) {
  background: var(--color-apple-blue, #0071e3);
  color: var(--color-ice, #f4f8fb);
  font-weight: 500;
}

.dashboard-segment :deep(.dashboard-segment__trigger[data-state='active']:hover),
.dashboard-segment :deep(.dashboard-segment__trigger[aria-selected='true']:hover) {
  background: var(--color-link-blue, #0066cc);
  color: var(--color-ice, #f4f8fb);
}

.dashboard-segment :deep(.dashboard-segment__trigger:focus-visible) {
  outline: 2px solid var(--color-apple-blue, #0071e3);
  outline-offset: 2px;
  box-shadow: none;
}

.dashboard-segment :deep(.dashboard-segment__trigger:active:not(:disabled)) {
  transform: scale(0.98);
}

.dashboard-content-area {
  flex: 1;
  min-width: 0;
  width: 100%;
}

@media (max-width: 768px) {
  .dashboard-layout {
    flex-direction: column;
  }

  .dashboard-sidebar {
    width: 100%;
  }

  .dashboard-segment :deep(.dashboard-segment__list) {
    flex-direction: row;
  }

  .dashboard-segment :deep(.dashboard-segment__trigger) {
    flex: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-segment :deep(.dashboard-segment__trigger) {
    transition: none;
  }

  .dashboard-segment :deep(.dashboard-segment__trigger:active:not(:disabled)) {
    transform: none;
  }
}
</style>
