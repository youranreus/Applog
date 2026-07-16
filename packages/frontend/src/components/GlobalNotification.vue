<script setup lang="ts">
import { watch } from 'vue';
import { toast } from 'vue-sonner';
import { useLayoutStore } from '@/stores/useLayoutStore';
import type { INotification, NotificationType } from '@/types/notification';

/**
 * 布局 Store
 */
const layoutStore = useLayoutStore();

/**
 * 已通过 Sonner 展示过的通知 ID，避免重复 toast
 */
const shownNotificationIds = new Set<string>();

/**
 * 将通知类型映射为 Sonner toast 方法
 * @param type - 通知类型
 * @returns 对应的 toast 调用函数
 */
function getToastFn(type: NotificationType): typeof toast.success {
  if (type === 'success') {
    return toast.success;
  }
  if (type === 'error') {
    return toast.error;
  }
  return toast.info;
}

/**
 * 用 Sonner 展示单条通知
 * @param notification - 通知数据
 *
 * 逻辑说明：
 * 1. 标题作为主文案，副标题与内容拼成 description
 * 2. duration 为 0 时不自动关闭
 * 3. 关闭时从 layoutStore 队列移除，保持 API 一致
 */
function showToast(notification: INotification): void {
  const descriptionParts = [notification.subtitle, notification.content].filter(Boolean);
  const toastFn = getToastFn(notification.type);

  toastFn(notification.title, {
    id: notification.id,
    description: descriptionParts.length > 0 ? descriptionParts.join(' · ') : undefined,
    duration: notification.duration > 0 ? notification.duration : Infinity,
    closeButton: notification.closable,
    onDismiss: () => {
      layoutStore.removeNotification(notification.id);
      shownNotificationIds.delete(notification.id);
    },
    onAutoClose: () => {
      layoutStore.removeNotification(notification.id);
      shownNotificationIds.delete(notification.id);
    },
  });
}

/**
 * 监听通知队列，将新增项同步到 Sonner
 *
 * 逻辑说明：
 * 1. 对队列中尚未展示的通知调用 toast
 * 2. 已被 store 移除但仍在 shown 集合中的 ID 予以清理
 */
watch(
  () => layoutStore.notifications,
  (notifications) => {
    const currentIds = new Set(notifications.map((n) => n.id));

    for (const notification of notifications) {
      if (!shownNotificationIds.has(notification.id)) {
        shownNotificationIds.add(notification.id);
        showToast(notification);
      }
    }

    for (const id of shownNotificationIds) {
      if (!currentIds.has(id)) {
        toast.dismiss(id);
        shownNotificationIds.delete(id);
      }
    }
  },
  { immediate: true, deep: true },
);
</script>

<template>
  <!-- 无可见 DOM：仅负责将 layoutStore 通知桥接到 Sonner -->
  <span class="hidden" aria-hidden="true" />
</template>
