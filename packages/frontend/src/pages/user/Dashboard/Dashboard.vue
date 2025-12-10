<script setup lang="ts">
import { computed, ref } from 'vue';
import { kMenuList, kMenuListItem } from 'konsta/vue';
import { useSystemStore } from '@/stores/useSystemStore';
import { useUserStore } from '@/stores/useUserStore';
import { useSystemInitialize } from './hooks/useSystemInitialize';
import SystemInitialize from './components/SystemInitialize.vue';
import PersonalStats from './components/PersonalStats.vue';
import SystemSettings from './components/SystemSettings.vue';

/**
 * Tab 类型定义
 */
type TabType = 'stats' | 'settings';

/**
 * 使用系统配置 Store 获取配置状态
 */
const systemStore = useSystemStore();

/**
 * 使用用户 Store 获取用户信息
 */
const userStore = useUserStore();

/**
 * 使用系统初始化 Hook 处理初始化逻辑
 */
const {
  loading: initLoading,
  handleInitialize,
} = useSystemInitialize(async () => {
  await systemStore.refreshConfig();
});

/**
 * 判断是否显示初始化按钮
 * 当配置为空或请求失败时返回 true
 */
const showInitializeButton = computed(() => {
  // 如果正在加载配置，不显示初始化按钮
  if (systemStore.loading) {
    return false;
  }
  
  // 如果配置为空或请求失败，显示初始化按钮
  return !systemStore.config || !!systemStore.error;
});

/**
 * 当前选中的 tab
 */
const activeTab = ref<TabType>('stats');

/**
 * Tab 配置列表
 */
const tabs = [
  { key: 'stats' as TabType, label: '个人统计', icon: '📊' },
  { key: 'settings' as TabType, label: '系统设置', icon: '⚙️' },
];

/**
 * 切换 tab
 * @param tab - 要切换到的 tab key
 */
function switchTab(tab: TabType): void {
  activeTab.value = tab;
}

</script>

<template>
  <div class="dashboard-page common-page-container">
    <div class="page-header mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">用户中心</h1>
      <p class="text-gray-600">欢迎来到用户控制面板</p>
    </div>

    <div class="dashboard-content">
      <!-- 系统初始化提示 -->
      <SystemInitialize
        v-if="showInitializeButton"
        :loading="initLoading"
        @initialize="handleInitialize"
      />

      <!-- 正常内容 -->
      <div v-else class="dashboard-main">
        <div class="dashboard-layout">
          <!-- 左侧栏 -->
          <aside class="dashboard-sidebar">
            <!-- 用户信息卡片 -->
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
                  class="user-avatar user-avatar-emoji"
                >
                  👤
                </div>
              </div>
              <h3 class="user-name">{{ userStore.user?.name || '未登录' }}</h3>
              <p class="user-email">{{ userStore.user?.email || '' }}</p>
            </div>

            <!-- Tab 导航 -->
            <k-menu-list strong-ios>
              <k-menu-list-item
                v-for="tab in tabs"
                :key="tab.key"
                :title="tab.label"
                :active="activeTab === tab.key"
                class="px-0"
                @click="switchTab(tab.key)"
              >
              </k-menu-list-item>
            </k-menu-list>
          </aside>

          <!-- 右侧内容区 -->
          <main class="dashboard-content-area">
            <!-- 个人统计 -->
            <PersonalStats v-if="activeTab === 'stats'" />

            <!-- 系统设置 -->
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
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
}

.dashboard-content {
  margin-top: 2rem;
}

.dashboard-main {
  width: 100%;
}

.dashboard-layout {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

/* 左侧栏 */
.dashboard-sidebar {
  flex-shrink: 0;
  width: 280px;
}

/* 用户信息卡片 */
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

.user-avatar-emoji {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e5e7eb;
  font-size: 2.5rem;
  line-height: 1;
}

.user-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}

.user-email {
  font-size: 0.875rem;
  color: #6b7280;
}

/* 右侧内容区 */
.dashboard-content-area {
  flex: 1;
  min-width: 0;
  width: 100%;
}

:deep(.k-list-item) a {
  margin: 0;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .dashboard-layout {
    flex-direction: column;
  }

  .dashboard-sidebar {
    width: 100%;
  }

}
</style>

