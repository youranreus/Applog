<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  /**
   * 视频 ID（从 content prop 中获取）
   */
  content: string;
}

const props = defineProps<Props>();

/**
 * 计算 iframe 的 src 属性
 * 将视频 ID 替换到 bvid 参数中
 */
const iframeSrc = computed(() => {
  const videoId = props.content.trim();
  if (!videoId) {
    return '';
  }
  return `//player.bilibili.com/player.html?isOutside=true&bvid=${videoId}&cid=35075263692&p=1`;
});
</script>

<template>
  <div class="flex justify-center items-center w-full py-6">
    <div v-if="!content.trim()" class="text-center text-red-500 py-2">
      <p class="text-sm">视频 ID 不能为空</p>
    </div>
    <div v-else class="w-full max-w-4xl">
      <iframe
        :src="iframeSrc"
        scrolling="no"
        border="0"
        frameborder="no"
        framespacing="0"
        allowfullscreen="true"
        class="w-full aspect-video"
      />
    </div>
  </div>
</template>

<style scoped>
@reference 'tailwindcss';
</style>
