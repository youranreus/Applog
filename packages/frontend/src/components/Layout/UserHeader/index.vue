<script setup lang="ts">
import type { IProps, IEmits } from './types';
import { useUserHeader } from './hooks/useUserHeader';

defineOptions({
  name: 'UserHeader',
});

const props = defineProps<IProps>();
const emits = defineEmits<IEmits>();

const { navPages, showBack, handleBack } = useUserHeader(props, emits);
</script>

<template>
  <header class="header-container">
    <div class="max-w-7xl mx-auto bg-[#f1f1f1df] backdrop-blur-sm px-5 py-3 rounded-full flex items-center">
      <div
        class="header-back-wrapper"
        :class="{ 'is-visible': showBack }"
        @click="handleBack"
      >
        <div class="header-back">
          <ion-icon name="arrow-back-outline"></ion-icon>
        </div>
      </div>
      <nav class="flex items-center gap-4">
        <router-link
          v-for="item in navPages"
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

.header-back-wrapper {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  transition: max-width 0.2s ease, padding-right 0.2s ease, opacity 0.2s ease;
}

.header-back-wrapper.is-visible {
  max-width: 1.5rem;
  padding-right: 32px;
  opacity: 1;
  pointer-events: auto;
}

.header-back {
  @apply cursor-pointer h-5 flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity;
  @apply min-w-5;
}
</style>
