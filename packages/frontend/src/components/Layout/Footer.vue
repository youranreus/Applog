<script setup lang="ts">
import { computed } from 'vue'
import { kLink } from 'konsta/vue'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { useSystemStore } from '@/stores/useSystemStore'
import { ROUTE_NAMES } from '@/constants/permission'

const currentYear = computed(() => new Date().getFullYear())
const layoutStore = useLayoutStore()
const systemStore = useSystemStore()

const buildInfo = import.meta.env.VITE_GIT_BRANCH && import.meta.env.VITE_GIT_COMMIT
  ? `${import.meta.env.VITE_GIT_BRANCH}@${import.meta.env.VITE_GIT_COMMIT}`
  : null
</script>

<template>
  <footer class="bg-[#f5f5f7]">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex flex-col sm:flex-row items-start sm:items-center min-h-16 py-3 sm:py-0 gap-y-2 sm:gap-y-0">
        <!-- showInFooter 页面链接（移动端排首位） -->
        <div class="flex items-center gap-x-3 order-first sm:order-2 sm:ml-6">
          <template v-for="(page, index) in layoutStore.footerPages" :key="page.id">
            <div
              v-if="index > 0"
              class="w-px h-[14px] bg-[#d2d2d7]"
            >
            </div>
            <k-link
              component="router-link"
              :link-props="{ to: `/${page.slug}.html` }"
              class="text-xs text-[#424245]! hover:underline"
            >
              {{ page.title }}
            </k-link>
          </template>

          <div
            v-if="layoutStore.footerPages.length > 0"
            class="w-px h-[14px] bg-[#d2d2d7]"
          >
          </div>
          <router-link
            :to="{ name: ROUTE_NAMES.USER_DASHBOARD }"
            class="text-xs text-[#424245]! hover:underline"
          >
            管理
          </router-link>
        </div>

        <!-- 版权 + 构建信息（移动端同行两端对齐，桌面端融入父级 flex） -->
        <div class="flex items-center w-full justify-between sm:contents gap-x-4 sm:gap-x-0">
          <p class="text-xs text-gray-600 sm:ml-10 sm:order-1">
            Copyright © {{ currentYear }} {{ systemStore.config?.title || 'AppLog' }}.
          </p>
          <p v-if="buildInfo" class="text-xs text-gray-400 sm:ml-auto sm:order-3">
            {{ buildInfo }}
          </p>
        </div>
      </div>
    </div>
  </footer>
</template>

