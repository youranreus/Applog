<script setup lang="ts">
import { onMounted } from 'vue'
import type { IProps } from './types'
import { usePhotos } from './hooks/usePhotos'

defineOptions({
  name: 'Photos',
})

const props = defineProps<IProps>()

const { photoItems, allImagesLoaded, handleMounted } = usePhotos(props)

onMounted(() => {
  handleMounted()
})
</script>

<template>
  <div class="photos-outer w-full my-4">
    <!-- 加载中占位符：仅在图片未完全预加载时显示，不占用图片区域高度 -->
    <div
      v-if="!allImagesLoaded"
      class="photos-placeholder flex items-center justify-center min-h-[50px] text-gray-600 text-sm"
    >
      图片加载中
    </div>

    <!-- 图片列表：预加载完成后才渲染（图片已在浏览器缓存），每张图片独立错开渐入+去模糊 -->
    <div v-if="allImagesLoaded" class="photos-container flex w-full">
      <div
        v-for="(item, index) in photoItems"
        :key="index"
        class="photo-item photo-item-enter"
        :style="{ animationDelay: `${index * 80}ms` }"
      >
        <div class="photo-wrapper group">
          <img :src="item.url" :alt="item.description" class="photo-image" />
          <div
            class="photo-description group-hover:opacity-100 opacity-60 transition-opacity duration-300"
          >
            {{ item.description }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference 'tailwindcss';

.photos-container {
  @apply flex gap-x-2 sm:gap-x-4;
}

/* 每张图片独立渐入 + 模糊消除动画 */
@keyframes photoItemEnter {
  from {
    opacity: 0;
    filter: blur(8px);
  }
  to {
    opacity: 1;
    filter: blur(0);
  }
}

.photo-item-enter {
  animation: photoItemEnter 0.6s ease-out both;
}

.photo-item {
  @apply flex-1 min-w-0 aspect-square relative;
}

.photo-wrapper {
  @apply absolute inset-0 overflow-hidden rounded-lg border border-gray-100;
}

.photo-image {
  @apply w-full h-full object-cover m-0 max-w-[unset];
}

.photo-description {
  @apply absolute bottom-0 left-0 w-full text-center text-white text-sm p-2 truncate;
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.7);
}
</style>
