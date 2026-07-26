<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { useSystemStore } from '@/stores/useSystemStore'
import { ROUTE_NAMES } from '@/constants/permission'
import { getSiteUptimeText } from '@/utils/site-uptime'

const ICP_FILING_URL = 'https://beian.miit.gov.cn/'

const currentYear = computed(() => new Date().getFullYear())
const layoutStore = useLayoutStore()
const systemStore = useSystemStore()

const buildInfo = import.meta.env.VITE_GIT_BRANCH && import.meta.env.VITE_GIT_COMMIT
  ? `${import.meta.env.VITE_GIT_BRANCH}@${import.meta.env.VITE_GIT_COMMIT}`
  : null

/**
 * 当前时间戳，每秒刷新以驱动运行时间文案
 */
const now = ref(Date.now())
let uptimeTimer: ReturnType<typeof setInterval> | null = null

/**
 * 备案号（trim 后非空才展示）
 */
const icpFilingNumber = computed(() => {
  const value = systemStore.config?.icpFilingNumber?.trim()
  return value || null
})

/**
 * 实时运行时间文案
 */
const uptimeText = computed(() => {
  return getSiteUptimeText(systemStore.config?.siteFoundedDate, now.value)
})

/**
 * 是否渲染第二行次要信息（备案 / 运行时间）
 */
const showMetaRow = computed(() => {
  return Boolean(icpFilingNumber.value || uptimeText.value)
})

onMounted(() => {
  uptimeTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (uptimeTimer) {
    clearInterval(uptimeTimer)
    uptimeTimer = null
  }
})
</script>

<template>
  <footer class="bg-[#f5f5f7]">
    <div class="common-page-container common-page-container--flush footer-container flex flex-col justify-center gap-y-4">
      <!-- 上行：备案 / 运行时间（仅配置后展示） -->
      <div
        v-if="showMetaRow"
        class="flex flex-col sm:flex-row sm:items-center gap-y-1 sm:gap-y-0"
      >
        <a
          v-if="icpFilingNumber"
          :href="ICP_FILING_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-[#707070]! hover:underline"
        >
          {{ icpFilingNumber }}
        </a>
        <span
          v-if="icpFilingNumber && uptimeText"
          class="hidden sm:inline mx-1.5 text-xs text-gray-400"
          aria-hidden="true"
        >
          ·
        </span>
        <p v-if="uptimeText" class="text-xs text-[#707070]">
          {{ uptimeText }}
        </p>
      </div>

      <!-- 下行：版权 + 导航（+ 可选 buildInfo），保持原有单行布局 -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-y-2 sm:gap-y-0">
        <!-- showInFooter 页面链接（移动端排首位） -->
        <div class="flex items-center gap-x-3 order-first sm:order-2 sm:ml-6">
          <template v-for="(page, index) in layoutStore.footerPages" :key="page.id">
            <div
              v-if="index > 0"
              class="w-px h-[14px] bg-[#d2d2d7]"
            >
            </div>
            <router-link
              :to="`/${page.slug}.html`"
              class="text-xs text-[#424245]! hover:underline"
            >
              {{ page.title }}
            </router-link>
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
          <p class="text-xs text-gray-600 sm:order-1">
            Copyright © {{ currentYear }} {{ systemStore.config?.title || 'AppLog' }}.
          </p>
          <p v-if="buildInfo" class="text-xs text-[#707070] sm:ml-auto sm:order-3">
            {{ buildInfo }}
          </p>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer-container {
  /* 覆盖 common-page-container 的 padding-top: 2rem；仅保留页脚自身上下边距 */
  padding-top: 1rem;
  padding-bottom: 1rem;
}
</style>
