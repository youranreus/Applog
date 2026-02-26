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
      <div class="flex items-center h-16 gap-x-10">
        <p class="text-xs text-gray-600">
          Copyright © {{ currentYear }} {{ systemStore.config?.title || 'AppLog' }}.
        </p>
        <!-- showInFooter 页面链接 -->
        <div class="flex items-center gap-x-3">
          <template v-for="(page, index) in layoutStore.footerPages" :key="page.id">
            <div
              v-if="index > 0"
              class="w-px h-[14px] bg-[#d2d2d7]"
            >
            </div>
            <k-link
              component="router-link"
              :link-props="{ to: `/page/${page.slug}` }"
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
        <!-- admin entrance -->
        <p v-if="buildInfo" class="text-xs text-gray-400 ml-auto">
          {{ buildInfo }}
        </p>
      </div>
    </div>
  </footer>
</template>

