<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { IProps, IEmits } from './types'
import { LANDING_GRID_ITEMS } from './constants'
import { useLanding } from './hooks/useLanding'
import { useSystemStore } from '@/stores/useSystemStore'
import { useSeoHead } from '@/hooks/useSeoHead'
import { useWebSiteJsonLd } from '@/hooks/useJsonLd'

defineOptions({
  name: 'Landing',
})

const props = defineProps<IProps>()
const emits = defineEmits<IEmits>() as IEmits

const { getColSpanClass, getRowSpanClass, getCardThemeClass, getCardBgStyle, getHrefType } =
  useLanding(props, emits)

const systemStore = useSystemStore()
const SITE_URL = import.meta.env.VITE_SITE_URL || ''

useSeoHead({
  description: () => systemStore.config?.description,
  canonicalPath: '/landing',
})

useWebSiteJsonLd({
  name: systemStore.config?.title || 'AppLog',
  description: systemStore.config?.description,
  url: SITE_URL,
})
</script>

<template>
  <div class="landing-page">
    <div class="landing-scroll-content">
      <!-- 栅格区 -->
      <section class="landing-grid-wrap">
        <div class="landing-grid">
          <component
            :is="
              getHrefType(item.href) === 'external'
                ? 'a'
                : getHrefType(item.href) === 'internal'
                  ? RouterLink
                  : 'div'
            "
            v-for="item in LANDING_GRID_ITEMS"
            :key="item.id"
            :class="[getColSpanClass(item), getRowSpanClass(item), getCardThemeClass(item.theme), item.href ? 'cursor-pointer' : '']"
            :style="getCardBgStyle(item)"
            :href="getHrefType(item.href) === 'external' ? item.href : undefined"
            :to="getHrefType(item.href) === 'internal' ? item.href : undefined"
            :target="getHrefType(item.href) === 'external' ? '_blank' : undefined"
            :rel="getHrefType(item.href) === 'external' ? 'noopener noreferrer' : undefined"
          >
            <!-- 右上角导航箭头 -->
            <span v-if="item.href" class="landing-card__nav-arrow">
              <ion-icon name="arrow-forward-outline" />
            </span>

            <!-- icon + description 横排行 -->
            <div v-if="item.icon || item.description" class="landing-card__info-row">
              <span v-if="item.icon" class="landing-card__icon" :style="item.iconColor ? { color: item.iconColor } : undefined">
                <ion-icon :name="item.icon" />
              </span>
              <span v-if="item.description" class="landing-card__description" :style="(item.descriptionColor || item.iconColor) ? { color: item.descriptionColor ?? item.iconColor } : undefined">
                {{ item.description }}
              </span>
            </div>

            <!-- 图片区 -->
            <div v-if="item.image && item.theme === 'image'" class="landing-card__image-wrap">
              <img :src="item.image" alt="" class="landing-card__image" />
            </div>

            <!-- badge 浮层 -->
            <div
              v-if="item.badge && (item.badge.emoji || item.badge.label)"
              :class="[
                'landing-card__badge',
                item.badge.position === 'bottom-right'
                  ? 'landing-card__badge--bottom-right'
                  : 'landing-card__badge--bottom-left',
              ]"
            >
              <span v-if="item.badge.emoji" class="landing-card__badge-emoji">{{
                item.badge.emoji
              }}</span>
              <span v-if="item.badge.label" class="landing-card__badge-label" :style="item.badge.labelColor ? { color: item.badge.labelColor } : undefined">{{
                item.badge.label
              }}</span>
            </div>
          </component>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.landing-page {
  @apply w-full min-h-[calc(100vh-64px)] relative py-[20vh];
}

.landing-scroll-content {
  @apply relative w-full min-h-full z-1 px-4 sm:px-6 lg:px-8;
}

/* 栅格区 - 响应式容器宽度（较阅读页更宽以容纳三列网格） */
.landing-grid-wrap {
  @apply mx-auto;
  max-width: 1060px;
}

@media screen and (min-width: 768px) and (max-width: 1250px) {
  .landing-grid-wrap {
    max-width: 960px;
  }
}

@media screen and (min-width: 1251px) and (max-width: 1599px) {
  .landing-grid-wrap {
    max-width: 1060px;
  }
}

@media screen and (min-width: 1600px) and (max-width: 1799px) {
  .landing-grid-wrap {
    max-width: 1152px;
  }
}

@media screen and (min-width: 1800px) and (max-width: 1919px) {
  .landing-grid-wrap {
    max-width: 1200px;
  }
}

@media screen and (min-width: 1920px) {
  .landing-grid-wrap {
    max-width: 1280px;
  }
}

.landing-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4;
}

.landing-card {
  @apply relative rounded-xl p-5 aspect-square md:aspect-auto md:min-h-[400px] flex flex-col overflow-hidden transition-transform duration-300 ease-out hover:-translate-y-2;
}

.landing-card--text {
  @apply bg-gray-100 text-gray-900;
}

.landing-card--image {
  @apply bg-gray-200 text-gray-900;
}

.landing-card--accent {
  @apply bg-amber-400 text-black;
}

.landing-card__nav-arrow {
  @apply absolute top-3 right-3 text-base opacity-50;
}

.landing-card__info-row {
  @apply flex flex-row items-center gap-2 mb-2;
}

.landing-card__icon {
  @apply text-sm text-gray-500;
}

.landing-card__description {
  @apply text-sm opacity-90 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md;
}

.landing-card__image-wrap {
  @apply mt-3 rounded-lg overflow-hidden flex-1 min-h-[120px];
}

.landing-card__image {
  @apply w-full h-full object-cover;
}

.landing-card__badge {
  @apply absolute flex flex-col gap-2;
}

.landing-card__badge--bottom-left {
  @apply bottom-5 left-5 items-start;
}

.landing-card__badge--bottom-right {
  @apply bottom-5 right-5 items-end;
}

.landing-card__badge-emoji {
  @apply text-[64px] leading-none;
}

.landing-card__badge-label {
  @apply text-[32px] font-medium text-[#1d1d1f] px-3 py-1 rounded-2xl bg-white/20 backdrop-blur-md;
}
</style>
