<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

/**
 * 导航到指定路由
 * @param name - 路由名称
 */
const navigateTo = (name: string) => {
  router.push({ name })
}
</script>

<template>
  <header class="header-container">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-[52px]">
        <h1
          class="text-xl font-medium text-gray-900 select-none cursor-pointer"
          @click="navigateTo('home')"
        >
          AppLog
        </h1>
        <nav class="flex items-center">
          <router-link
            :to="{ name: 'home' }"
            class="header-link"
            active-class="header-link-active"
          >
            首页
          </router-link>
          <router-link
            :to="{ name: 'postList' }"
            class="header-link"
            active-class="header-link-active"
          >
            文章
          </router-link>
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