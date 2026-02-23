import { ref, readonly, watch, nextTick, onUnmounted, type Ref } from 'vue';
import { processMarkdown } from '@/utils/markdown';
import { wrapImagesForLazyLoad } from '../utils';
import type { IProps } from '../types';

const LAZY_IMAGE_SELECTOR = '.lazy-image';
const PLACEHOLDER_SELECTOR = '.lazy-image-placeholder';

/**
 * 在容器内为懒加载图片建立 IntersectionObserver，进入视口时加载并添加 .loaded 动画
 *
 * @param container - 渲染内容根元素
 * @param observerRef - 用于保存当前 observer，便于清理
 */
function setupLazyLoad(container: HTMLElement, observerRef: { current: IntersectionObserver | null }): void {
  observerRef.current?.disconnect();
  observerRef.current = null;

  const images = container.querySelectorAll<HTMLImageElement>(LAZY_IMAGE_SELECTOR);
  if (images.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target as HTMLImageElement;
        const src = img.getAttribute('data-src');
        if (!src) return;
        img.src = src;
        img.removeAttribute('data-src');
        observer.unobserve(img);

        img.onload = () => {
          img.classList.add('loaded');
          const wrapper = img.closest('.lazy-image-wrapper');
          const placeholder = wrapper?.querySelector(PLACEHOLDER_SELECTOR);
          if (placeholder instanceof HTMLElement) {
            placeholder.style.display = 'none';
          }
        };
      });
    },
    { rootMargin: '50px', threshold: 0.01 },
  );

  images.forEach((el) => observer.observe(el));
  observerRef.current = observer;
}

/**
 * Markdown 渲染与图片懒加载逻辑
 *
 * @param props - 组件 props
 * @param containerRef - 渲染根元素 ref，用于挂载后查询懒加载图片
 * @returns 渲染结果与状态
 */
export function useMarkdownRenderer(props: IProps, containerRef: Ref<HTMLElement | null>) {
  const renderedHtml = ref<string>('');
  const observerRef: { current: IntersectionObserver | null } = { current: null };

  const updateContent = async () => {
    if (props.content) {
      const html = await processMarkdown(props.content);
      renderedHtml.value = wrapImagesForLazyLoad(html);
    } else {
      renderedHtml.value = '';
    }
  };

  const attachLazyLoad = () => {
    const el = containerRef.value;
    if (!el) return;
    nextTick(() => setupLazyLoad(el, observerRef));
  };

  watch(
    () => props.content,
    async () => {
      await updateContent();
      attachLazyLoad();
    },
    { immediate: true },
  );

  watch(renderedHtml, () => attachLazyLoad());

  onUnmounted(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  });

  return {
    renderedHtml: readonly(renderedHtml),
  };
}
