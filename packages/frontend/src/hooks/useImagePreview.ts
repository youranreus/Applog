import { ref, readonly, watch, onUnmounted, type Ref } from 'vue';

/**
 * 判断图片是否应排除预览（.bq 装饰性图片）
 * @param img - 图片元素
 * @returns 若图片自身带 .bq 或在 .bq 祖先内则返回 true
 */
function shouldExcludeImage(img: HTMLImageElement): boolean {
  if (img.classList.contains('bq')) return true;
  return img.closest('.bq') !== null;
}

/**
 * 从图片元素获取用于预览的 src（支持懒加载的 data-src）
 * @param img - 图片元素
 * @returns 图片地址，无有效地址时返回空字符串
 */
function getImageSrc(img: HTMLImageElement): string {
  const src = img.src || img.getAttribute('data-src') || '';
  return typeof src === 'string' ? src.trim() : '';
}

/**
 * 图片点击预览 Hook
 * 在指定容器内通过事件委托监听 img 点击，打开单图预览（排除 .bq 图片）
 *
 * @param containerRef - 内容容器 ref，其内的 img 点击会触发预览
 * @returns 预览状态与关闭方法，需配合 ImagePreview 组件使用
 *
 * 逻辑说明：
 * 1. watch containerRef，有值时在容器上绑定 click 委托
 * 2. 点击目标为 img 且非 .bq 时，记录 src、alt 并打开预览
 * 3. onUnmounted 移除事件监听，避免泄漏
 */
export function useImagePreview(containerRef: Ref<HTMLElement | null>) {
  // ========== 状态定义区 ==========
  const previewVisible = ref(false);
  const previewSrc = ref('');
  const previewAlt = ref('');

  const setPreviewVisible = (value: boolean): void => {
    previewVisible.value = value;
  };

  const setPreview = (src: string, alt: string): void => {
    previewSrc.value = src;
    previewAlt.value = alt ?? '';
    setPreviewVisible(true);
  };

  const clearPreview = (): void => {
    setPreviewVisible(false);
    previewSrc.value = '';
    previewAlt.value = '';
  };

  // ========== 业务逻辑区 ==========

  /**
   * 关闭预览层
   */
  const closePreview = (): void => {
    clearPreview();
  };

  /**
   * 处理容器内点击，若点击的是可预览图片则打开预览
   * @param e - 点击事件
   */
  const handleContainerClick = (e: MouseEvent): void => {
    const target = e.target;
    if (!(target instanceof HTMLImageElement)) return;
    if (shouldExcludeImage(target)) return;

    const src = getImageSrc(target);
    if (!src) return;

    const alt = (target.getAttribute('alt') ?? '').trim();
    setPreview(src, alt);
  };

  /**
   * 在容器上绑定点击委托
   */
  const attachListener = (el: HTMLElement): void => {
    el.addEventListener('click', handleContainerClick);
  };

  /**
   * 移除容器上的点击监听
   */
  const detachListener = (el: HTMLElement): void => {
    el.removeEventListener('click', handleContainerClick);
  };

  // ========== 生命周期：根据 containerRef 挂载/卸载监听 ==========

  const cleanupRef = { current: null as (() => void) | null };

  watch(
    containerRef,
    (el, prevEl) => {
      if (prevEl) {
        detachListener(prevEl);
        cleanupRef.current = null;
      }
      if (el) {
        attachListener(el);
        cleanupRef.current = () => detachListener(el);
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    clearPreview();
  });

  return {
    previewVisible: readonly(previewVisible),
    previewSrc: readonly(previewSrc),
    previewAlt: readonly(previewAlt),
    closePreview,
  };
}
