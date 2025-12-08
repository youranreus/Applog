<script setup lang="ts">
import { useLayoutStore } from '@/stores/useLayoutStore';

const layoutStore = useLayoutStore();

</script>

<template>
  <header class="header-container">
    <div class="max-w-7xl mx-auto bg-[#f1f1f1df] backdrop-blur-sm px-5 py-3 rounded-full flex items-center gap-x-8">
      <nav class="flex items-center gap-4">
        <router-link
          v-for="item in layoutStore.navPages"
          :key="item.id"
          :to="item.to"
          class="header-link"
          active-class="header-link-active"
        >
          {{ item.title }}
        </router-link>
      </nav>
    </div>
  </header>
</template>

<style scoped>
@reference "tailwindcss";

.header-container {
  @apply fixed top-0 left-0 right-0 z-50 w-full py-4;
  @apply flex items-center justify-center;
}

.header-link {
  @apply font-normal text-black text-sm transition-colors opacity-50;
}

.header-link-active {
  @apply opacity-100;
}
</style>