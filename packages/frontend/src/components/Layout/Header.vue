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
  <header class="bg-white border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <h1
          class="text-xl font-bold text-gray-900 select-none cursor-pointer"
          @click="navigateTo('home')"
        >
          AppLog
        </h1>
        <nav class="flex items-center space-x-4">
          <router-link
            :to="{ name: 'home' }"
            class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            active-class="text-gray-900 font-semibold"
          >
            首页
          </router-link>
          <router-link
            :to="{ name: 'postList' }"
            class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            active-class="text-gray-900 font-semibold"
          >
            文章
          </router-link>
        </nav>
      </div>
    </div>
  </header>
</template>

