<script setup lang="ts">
import { shallowRef } from 'vue'
defineProps<{ src: string; alt: string; token: string }>()
const failed = shallowRef(false)
</script>
<template>
  <span v-if="failed">{{ token }}</span
  ><img v-else class="comment-meme" :src="src" :alt="alt" loading="lazy" @error="failed = true" />
</template>
<style scoped>
.comment-meme {
  display: inline-block;
  width: auto;
  height: 2rem;
  margin: 0 0.1rem;
  vertical-align: middle;
}
</style>
