<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSystemStore } from '@/stores/useSystemStore';
import loadingIcon from '@/assets/icon/loading.svg';

/**
 * 系统配置 Store
 */
const systemStore = useSystemStore();

/**
 * 实际显示的加载状态（用于控制 UI）
 * 与 systemStore.loading 分离，以实现至少显示1秒的逻辑
 */
const displayLoading = ref<boolean>(false);

/**
 * 加载开始时间戳
 * 用于计算已显示的时长
 */
const loadingStartTime = ref<number | null>(null);

/**
 * 延迟隐藏的定时器 ID
 * 用于在组件卸载时清理定时器
 */
let hideTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 监听系统配置加载状态变化
 * 实现至少显示1秒的逻辑，避免闪烁
 */
watch(
  () => systemStore.loading,
  (newLoading: boolean) => {
    // 清理之前的定时器
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    if (newLoading) {
      // 开始加载：记录开始时间，立即显示
      loadingStartTime.value = Date.now();
      displayLoading.value = true;
    } else {
      // 结束加载：计算已显示时长，确保至少显示1秒
      if (loadingStartTime.value !== null) {
        const elapsed = Date.now() - loadingStartTime.value;
        const remaining = Math.max(0, 1000 - elapsed);

        // 如果已显示时间不足1秒，延迟隐藏
        if (remaining > 0) {
          hideTimer = setTimeout(() => {
            displayLoading.value = false;
            loadingStartTime.value = null;
          }, remaining);
        } else {
          // 已显示时间足够，立即隐藏
          displayLoading.value = false;
          loadingStartTime.value = null;
        }
      } else {
        // 如果没有开始时间记录，直接隐藏（异常情况）
        displayLoading.value = false;
      }
    }
  },
  { immediate: true }
);
</script>

<template>
  <Transition name="fade">
    <div v-show="displayLoading" class="global-loading">
      <div class="global-loading-content">
        <img :src="loadingIcon" alt="加载中" class="loading-icon" />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.global-loading {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgb(255, 255, 255);
}

.global-loading-content {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-icon {
  width: 64px;
  height: 64px;
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
