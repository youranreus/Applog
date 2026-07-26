<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import 'vue-sonner/style.css'
import Header from '@/components/Layout/Header.vue'
import Footer from '@/components/Layout/Footer.vue'
import UserHeader from '@/components/Layout/UserHeader/index.vue'
import GlobalLoading from '@/components/GlobalLoading.vue'
import GlobalNotification from '@/components/GlobalNotification.vue'
import VisitorCursors from '@/components/ui/visitor-cursors/index.vue'
import { Toaster } from '@/components/ui/sonner'
import { useSystemStore } from '@/stores/useSystemStore'
import { useLayoutStore } from '@/stores/useLayoutStore'

/**
 * 路由实例
 */
const route = useRoute()

/**
 * 系统配置 Store
 */
const systemStore = useSystemStore()

/**
 * 布局 Store
 */
const layoutStore = useLayoutStore()

/**
 * 是否显示布局（Header/Footer）
 * 通过路由 meta 中的 hideLayout 属性来判断
 */
const showLayout = computed<boolean>(() => {
  return !(route.meta.hideLayout === true)
})

/**
 * 全局 SEO head 配置
 * 设置 titleTemplate、OG 标签、html lang 属性
 */
const siteTitle = computed(() => systemStore.config?.title || 'AppLog')
const siteDescription = computed(() => systemStore.config?.description || '')

useHead({
  htmlAttrs: { lang: 'zh-CN' },
  titleTemplate: (title) => (title ? `${title} | ${siteTitle.value}` : siteTitle.value),
  meta: [
    { name: 'description', content: siteDescription },
    { property: 'og:site_name', content: siteTitle },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ],
})
</script>

<template>
  <div class="relative min-h-screen flex flex-col">
    <template v-if="showLayout">
      <Header v-if="layoutStore.currentNavGroup === 'user'" />
      <UserHeader v-else />
    </template>
    <main v-if="showLayout" class="flex-1 w-full">
      <RouterView v-slot="{ Component }">
        <Transition name="page-fade" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>
    <RouterView v-else v-slot="{ Component }">
      <Transition name="page-fade" mode="out-in">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
    <Footer v-if="showLayout" />
    <!-- 全局加载状态 -->
    <GlobalLoading />
    <!-- 全局通知适配层 -->
    <GlobalNotification />
    <!-- 公开页面的同路径访客鼠标 -->
    <VisitorCursors />
    <!-- Sonner 吐司容器（样式由 Sonner.vue / applog-toast 统一） -->
    <Toaster />
  </div>
</template>

<style scoped>
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>
