<script setup lang="ts">
import { computed, watch } from 'vue';
import { ref } from 'vue';
import { kNotification } from 'konsta/vue';
import { useLayoutStore } from '@/stores/useLayoutStore';
import type { INotification } from '@/types/notification';

/**
 * 布局 Store
 */
const layoutStore = useLayoutStore();

/**
 * 当前显示的通知
 */
const currentNotification = ref<INotification | null>(null);

/**
 * 通知是否打开
 */
const notificationOpened = ref(false);

/**
 * 通知标题右侧文本映射
 */
const titleRightTextMap: Record<string, string> = {
  success: '成功',
  error: '错误',
  info: '信息',
};

/**
 * 当前通知的标题右侧文本
 */
const titleRightText = computed(() => {
  if (!currentNotification.value) {
    return '';
  }
  return titleRightTextMap[currentNotification.value.type] || '信息';
});

/**
 * 监听通知队列变化，自动显示下一个通知
 * 
 * 逻辑说明：
 * 1. 当队列中有新通知且当前没有显示的通知时，显示队列中的第一个
 * 2. 当当前通知被关闭时，如果队列中还有通知，自动显示下一个
 */
watch(
  () => layoutStore.notifications,
  (newNotifications) => {
    // 如果当前没有显示通知，且队列中有通知，显示第一个
    if (!currentNotification.value && newNotifications.length > 0) {
      currentNotification.value = newNotifications[0]!;
      notificationOpened.value = true;
    }
    // 如果当前显示的通知不在队列中了（被移除了），清除当前通知
    else if (currentNotification.value) {
      const stillExists = newNotifications.some(
        (n) => n.id === currentNotification.value!.id
      );
      if (!stillExists) {
        currentNotification.value = null;
        notificationOpened.value = false;
        // 如果队列中还有通知，延迟显示下一个（等待关闭动画完成）
        if (newNotifications.length > 0) {
          setTimeout(() => {
            if (layoutStore.notifications.length > 0) {
              currentNotification.value = layoutStore.notifications[0]!;
              notificationOpened.value = true;
            }
          }, 300); // 等待关闭动画完成
        }
      }
    }
  },
  { immediate: true, deep: true }
);

/**
 * 监听 opened 状态变化，处理手动关闭
 * 当用户点击关闭按钮时，k-notification 会将 opened 设置为 false
 * 此时需要从队列中移除通知
 */
watch(notificationOpened, (opened) => {
  if (!opened && currentNotification.value) {
    // 通知被关闭，从队列中移除
    const id = currentNotification.value.id;
    layoutStore.removeNotification(id);
  }
});

/**
 * 处理通知关闭（点击通知时）
 * 
 * 逻辑说明：
 * 1. 关闭当前通知（设置 opened 为 false）
 * 2. watch 会监听到 opened 变化，自动从队列中移除
 */
function handleNotificationClose(): void {
  notificationOpened.value = false;
}
</script>

<template>
  <k-notification
    :opened="notificationOpened"
    :title="currentNotification?.title"
    :subtitle="currentNotification?.subtitle"
    :text="currentNotification?.content"
    :title-right-text="titleRightText"
    @click="handleNotificationClose"
  />
</template>
