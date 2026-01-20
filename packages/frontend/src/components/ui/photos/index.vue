<script setup lang="ts">
import { onMounted } from 'vue';
import type { IProps } from './types';
import { usePhotos } from './hooks/usePhotos';

defineOptions({
  name: 'Photos',
});

const props = defineProps<IProps>();

const { photoItems, handleMounted } = usePhotos(props);

onMounted(() => {
  handleMounted();
});
</script>

<template>
  <div class="photos-container flex w-full">
    <div
      v-for="(item, index) in photoItems"
      :key="index"
      class="photo-item"
      :style="{
        width: item.flexGrow ? `${item.flexGrow}px` : undefined,
        flexGrow: item.flexGrow,
      }"
    >
      <div
        class="photo-wrapper"
      >
        <img
          :src="item.url"
          :alt="item.description"
          class="photo-image"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference 'tailwindcss';

.photos-container {
  @apply flex my-4;
}

.photo-item {
  @apply shrink-0;
}

.photo-wrapper {
  @apply w-full overflow-hidden;
}

.photo-image {
  @apply w-full h-full object-cover m-0;
}
</style>
