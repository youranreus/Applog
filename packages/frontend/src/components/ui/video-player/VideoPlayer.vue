<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import Artplayer from 'artplayer'

interface Props {
  /**
   * 视频 ID（从 content prop 中获取）
   */
  content: string;
  url: string;
  pic?: string;
}

const props = defineProps<Props>();

const art = shallowRef<Artplayer | null>(null)
const $container = ref<HTMLDivElement | null>(null)

onMounted(() => {
  if ($container.value) {
    art.value = new Artplayer({
      container: $container.value,
      url: props.url,
      poster: props.pic,
      volume: 0.5,
      isLive: false,
      muted: false,
      autoplay: false,
      autoSize: true,
      screenshot: false,
      setting: true,
      loop: true,
      flip: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      subtitleOffset: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      playsInline: true,
      autoPlayback: true,
      airplay: true,
      theme: '#23ade5',
    })
  }
})

onBeforeUnmount(() => {
  art.value?.destroy(false)
})
</script>

<template>
  <div class="w-full py-6 aspect-video">
    <div ref="$container" class="w-full h-full"></div>
  </div>
</template>

<style scoped>
@reference 'tailwindcss';
</style>
