<script setup lang="ts">
import type { IProps, IEmits } from './types'
import { LANDING_GRID_ITEMS, LANDING_HERO_TITLE, LANDING_HERO_SUBTITLE } from './constants'
import { useLanding } from './hooks/useLanding'

defineOptions({
  name: 'Landing',
})

const props = defineProps<IProps>()
const emits = defineEmits<IEmits>() as IEmits

const { getColSpanClass, getRowSpanClass, getCardThemeClass } = useLanding(props, emits)
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
            :is="item.href ? 'a' : 'div'"
            v-for="item in LANDING_GRID_ITEMS"
            :key="item.id"
            :class="[getColSpanClass(item), getRowSpanClass(item), getCardThemeClass(item.theme)]"
            :href="item.href"
            :target="item.href ? '_blank' : undefined"
            :rel="item.href ? 'noopener noreferrer' : undefined"
          >
            <span v-if="item.icon" class="landing-card__icon">
              <ion-icon :name="item.icon" />
            </span>
            <span v-if="item.title" class="landing-card__title">
              {{ item.title }}
            </span>
            <p v-if="item.subtitle" class="landing-card__subtitle">
              {{ item.subtitle }}
            </p>
            <div v-if="item.image && item.theme === 'image'" class="landing-card__image-wrap">
              <img
                v-if="item.image"
                :src="item.image"
                :alt="item.title ?? ''"
                class="landing-card__image"
              />
              <div v-else class="landing-card__image-placeholder">图片</div>
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
  @apply rounded-xl p-5 min-h-[140px] flex flex-col overflow-hidden;
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

.landing-card__icon {
  @apply text-sm text-gray-500 mb-1;
}

.landing-card__title {
  @apply font-semibold text-lg mb-1;
}

.landing-card__subtitle {
  @apply text-sm opacity-90 flex-1;
}

.landing-card__image-wrap {
  @apply mt-3 rounded-lg overflow-hidden flex-1 min-h-[120px];
}

.landing-card__image {
  @apply w-full h-full object-cover;
}

.landing-card__image-placeholder {
  @apply w-full h-full min-h-[120px] flex items-center justify-center bg-gray-300 text-gray-500 text-sm;
}
</style>
