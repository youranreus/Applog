<script setup lang="ts">
import { computed } from 'vue'
import { parseMemeSegments } from '@/utils/markdown/meme-utils'
import MemeImage from './MemeImage.vue'

const props = defineProps<{ content: string }>()
const segments = computed(() => parseMemeSegments(props.content))
</script>

<template>
  <p class="comment-content">
    <template v-for="(segment, index) in segments" :key="index"
      ><span v-if="segment.type === 'text'">{{ segment.value }}</span
      ><MemeImage v-else :src="segment.src" :alt="segment.alt" :token="segment.token"
    /></template>
  </p>
</template>

<style scoped>
.comment-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--foreground);
  line-height: 1.7;
}
</style>
