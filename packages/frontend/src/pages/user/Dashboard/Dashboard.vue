<script setup lang="ts">
import { computed } from 'vue';
import { useSystemConfig } from './hooks/useSystemConfig';
import { useSystemInitialize } from './hooks/useSystemInitialize';
import SystemInitialize from './components/SystemInitialize.vue';

/**
 * 使用系统配置 Hook 获取配置状态
 */
const {
  config,
  loading: configLoading,
  error: configError,
  refreshConfig,
} = useSystemConfig();

/**
 * 使用系统初始化 Hook 处理初始化逻辑
 */
const {
  loading: initLoading,
  handleInitialize,
} = useSystemInitialize(async () => {
  await refreshConfig()
});

/**
 * 判断是否显示初始化按钮
 * 当配置为空或请求失败时返回 true
 */
const showInitializeButton = computed(() => {
  // 如果正在加载配置，不显示初始化按钮
  if (configLoading.value) {
    return false;
  }
  
  // 如果配置为空或请求失败，显示初始化按钮
  return !config.value || !!configError.value;
});
</script>

<template>
  <div class="dashboard-page">
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
      <div v-else-if="!configLoading" class="text-center text-gray-600 py-12">
        <p>用户中心功能开发中...</p>
      </div>

      <!-- 加载中 -->
      <div v-else class="text-center text-gray-600 py-12">
        <p>加载中...</p>
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
</style>

