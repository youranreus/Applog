<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { kApp } from 'konsta/vue';
import Header from '@/components/Layout/Header.vue';
import Footer from '@/components/Layout/Footer.vue';
import GlobalLoading from '@/components/GlobalLoading.vue';
import { useSystemStore } from '@/stores/useSystemStore';

/**
 * 路由实例
 */
const route = useRoute();

/**
 * 系统配置 Store
 */
const systemStore = useSystemStore();

/**
 * 是否显示布局（Header/Footer）
 * 通过路由 meta 中的 hideLayout 属性来判断
 */
const showLayout = computed<boolean>(() => {
  return !(route.meta.hideLayout === true);
});

/**
 * 监听系统配置变化，动态设置页面标题
 * 当配置加载完成且有标题时，使用配置的标题；否则使用默认值 "AppLog"
 */
watchEffect(() => {
  const title = systemStore.config?.title || 'AppLog';
  document.title = title;
});
</script>

<template>
  <k-app theme="ios">
    <div class="min-h-screen flex flex-col">
      <Header v-if="showLayout" />
      <main
        v-if="showLayout"
        class="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      >
        <router-view />
      </main>
      <router-view v-else />
      <Footer v-if="showLayout" />
    </div>
    <!-- 全局加载状态 -->
    <GlobalLoading />
  </k-app>
</template>
