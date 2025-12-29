<script setup lang="ts">
import { computed } from 'vue';
import loadingIcon from '@/assets/icon/loading.svg';

/**
 * Loading 组件 Props
 */
interface ILoadingProps {
  /**
   * 图标大小（像素）
   * @default 64
   */
  size?: number;
}

/**
 * 组件 Props
 */
const props = withDefaults(defineProps<ILoadingProps>(), {
  size: 64,
});

/**
 * 图标样式
 * 根据 size prop 动态设置宽高
 */
const iconStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}));
</script>

<template>
  <div class="loading-content">
    <img :src="loadingIcon" alt="加载中" class="loading-icon" :style="iconStyle" />
  </div>
</template>

<style scoped>
.loading-content {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-icon {
  display: block;
}
</style>
