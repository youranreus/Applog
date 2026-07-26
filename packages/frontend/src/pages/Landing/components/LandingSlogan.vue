<script setup lang="ts">
defineProps<{
  slogan: string;
}>();
</script>

<template>
  <footer class="landing-slogan">
    <p>{{ slogan }}</p>
  </footer>
</template>

<style scoped>
.landing-slogan {
  padding-top: clamp(5rem, 12vw, 8rem);
  text-align: center;
}

.landing-slogan p {
  max-width: 32ch;
  margin-inline: auto;
  color: var(--landing-muted);
  font-family: var(--landing-font-heading);
  font-size: clamp(1.0625rem, 1rem + 0.4vw, 1.3125rem);
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: -0.01em;
  text-wrap: balance;
}
</style>
