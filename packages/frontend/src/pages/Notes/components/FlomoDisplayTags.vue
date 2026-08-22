<script setup lang="ts">
defineProps<{ tags: readonly string[] }>()
</script>

<template>
  <ul v-if="tags.length" class="flomo-tags" aria-label="标签">
    <li v-for="tag in tags" :key="tag" class="flomo-tags__item">#{{ tag }}</li>
  </ul>
</template>

<style scoped>
.flomo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-width: 0;
}

.flomo-tags__item {
  max-width: 100%;
  padding: 0.18rem 0.52rem;
  overflow: hidden;
  border-radius: var(--radius-tags);
  background: var(--color-frost);
  color: var(--muted-foreground);
  font-size: 0.68rem;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
