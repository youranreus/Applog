<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { IProps, IEmits } from './types'
import { LANDING_GRID_ITEMS, LANDING_HERO_TITLE, LANDING_HERO_SUBTITLE } from './constants'
import { useLanding } from './hooks/useLanding'

defineOptions({
  name: 'Landing',
})

const props = defineProps<IProps>()
const emits = defineEmits<IEmits>() as IEmits

const { getColSpanClass, getRowSpanClass, getCardThemeClass, getCardBgStyle, getHrefType } =
  useLanding(props, emits)
</script>

<template>
  <div class="landing-page">
    <div class="landing-scroll-content">
      <!-- 标题区 -->
      <section class="landing-hero">
        <h1 class="landing-hero__title">
          {{ LANDING_HERO_TITLE }}
        </h1>
        <p v-if="LANDING_HERO_SUBTITLE" class="landing-hero__subtitle">
          {{ LANDING_HERO_SUBTITLE }}
        </p>
      </section>

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
            :class="[getColSpanClass(item), getRowSpanClass(item), getCardThemeClass(item.theme)]"
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
  @apply w-full min-h-[calc(100vh-64px)] relative pt-[20vh];
}

.landing-scroll-content {
  @apply relative w-full min-h-full z-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8;
}

/* 标题区 */
.landing-hero {
  @apply mx-auto mb-10 max-w-4xl;
}

.landing-hero__title {
  @apply text-3xl sm:text-4xl lg:text-5xl font-bold text-black tracking-tight;
}

.landing-hero__subtitle {
  @apply mt-2 text-sm text-gray-500;
}

/* 栅格区 */
.landing-grid-wrap {
  @apply mx-auto max-w-6xl;
}

.landing-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4;
}

.landing-card {
  @apply relative rounded-xl p-5 aspect-square md:aspect-auto md:min-h-[400px] flex flex-col overflow-hidden;
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
  @apply text-sm opacity-90;
}

.landing-card__image-wrap {
  @apply mt-3 rounded-lg overflow-hidden flex-1 min-h-[120px];
}

.landing-card__image {
  @apply w-full h-full object-cover;
}

.landing-card__badge {
  @apply absolute flex flex-col;
}

.landing-card__badge--bottom-left {
  @apply bottom-3 left-3 items-start;
}

.landing-card__badge--bottom-right {
  @apply bottom-3 right-3 items-end;
}

.landing-card__badge-emoji {
  @apply text-[64px] leading-none;
}

.landing-card__badge-label {
  @apply text-[32px] font-medium text-[#1d1d1f];
}
</style>
