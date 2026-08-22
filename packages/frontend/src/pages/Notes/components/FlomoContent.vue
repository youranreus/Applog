<script setup lang="ts">
defineProps<{ contentHtml: string }>()
</script>

<template>
  <!-- Sole v-html owner: contentHtml is the typed backend-sanitized allowlist field. -->
  <div class="flomo-content" v-html="contentHtml" />
</template>

<style scoped>
.flomo-content {
  color: var(--foreground);
  font-size: 0.975rem;
  line-height: 1.85;
  overflow-wrap: anywhere;
}

.flomo-content :deep(p + p),
.flomo-content :deep(blockquote),
.flomo-content :deep(ul),
.flomo-content :deep(ol),
.flomo-content :deep(pre) {
  margin-top: 1rem;
}

.flomo-content :deep(ul),
.flomo-content :deep(ol) {
  padding-left: 1.35rem;
}

.flomo-content :deep(ul) { list-style: disc; }
.flomo-content :deep(ol) { list-style: decimal; }

.flomo-content :deep(blockquote) {
  padding-left: 1rem;
  border-left: 2px solid var(--color-pebble);
  color: var(--muted-foreground);
}

.flomo-content :deep(pre),
.flomo-content :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.flomo-content :deep(pre) {
  overflow-x: auto;
  padding: 0.9rem;
  border-radius: var(--radius-cards);
  background: var(--color-frost);
}

.flomo-content :deep(a) {
  color: var(--color-link-blue);
  text-decoration: underline;
  text-underline-offset: 0.18em;
}
</style>
