<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useLayoutStore } from '@/stores/useLayoutStore';

const router = useRouter();
const layoutStore = useLayoutStore();

/**
 * 导航到指定路由
 * @param name - 路由名称
 */
const navigateTo = (name: string) => {
  router.push({ name });
};
</script>

<template>
  <header class="header-container">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-[52px]">
        <h1
          class="text-xl font-medium text-gray-900 select-none cursor-pointer"
          @click="navigateTo('postList')"
        >
          AppLog
        </h1>
        <nav class="flex items-center gap-1">
          <!-- 动态渲染从 store 获取的导航页面 -->
          <template v-if="layoutStore.loading">
            <span class="header-link text-gray-400">加载中...</span>
          </template>
          <template v-else-if="layoutStore.error">
            <span class="header-link text-red-400">加载失败</span>
          </template>
          <template v-else>
            <router-link
              v-for="item in layoutStore.navPages"
              :key="item.id"
              :to="item.to"
              class="header-link"
              active-class="header-link-active"
            >
              {{ item.title }}
            </router-link>
          </template>
        </nav>
      </div>
    </div>
  </header>
</template>

<style scoped>
@reference "tailwindcss";

.header-container {
  background: rgba(250, 250, 252, 0.8);
  @apply border-b border-gray-200;
}

.header-link {
  @apply font-normal hover:text-gray-900 px-3 py-2 rounded-md text-xs transition-colors;
}

.header-link-active {
  @apply text-gray-900 font-medium;
}
</style>