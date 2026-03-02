import { computed, onUnmounted, watchEffect, type Ref } from 'vue';
import { useSystemStore } from '@/stores/useSystemStore';

const DEFAULT_SITE_TITLE = 'AppLog';

/**
 * 根据页面标题动态设置 document.title，格式为「{pageTitle} | {siteTitle}」
 * 组件卸载时恢复为纯站点标题
 * @param pageTitle - 页面/文章标题（响应式引用，可为 undefined 表示未加载）
 *
 * 逻辑说明：
 * 1. 从 useSystemStore 读取站点标题，无配置时使用默认值
 * 2. watchEffect 监听 pageTitle 与 siteTitle，有页面标题时设为「标题 | 站点标题」，否则仅显示站点标题
 * 3. onUnmounted 时停止监听并恢复 document.title 为站点标题，避免影响其他页面
 */
export function useDocumentTitle(pageTitle: Ref<string | undefined>) {
  const systemStore = useSystemStore();
  const siteTitle = computed(() => systemStore.config?.title || DEFAULT_SITE_TITLE);

  const stop = watchEffect(() => {
    document.title = pageTitle.value
      ? `${pageTitle.value} | ${siteTitle.value}`
      : siteTitle.value;
  });

  onUnmounted(() => {
    stop();
    document.title = siteTitle.value;
  });
}
