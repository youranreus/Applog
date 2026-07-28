import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export interface IHorizontalScrollFades {
  scrollRef: Ref<HTMLElement | null>
  canScrollLeft: Ref<boolean>
  canScrollRight: Ref<boolean>
  updateScrollFades: () => void
}

/**
 * 根据横向滚动容器溢出状态切换左右渐变遮罩。
 * @returns 容器 ref、左右可滚动标记与手动刷新函数
 *
 * 逻辑说明：
 * 1. 比较 scrollLeft / scrollWidth / clientWidth
 * 2. 监听 scroll 与 resize，不可滚动时两侧均为 false
 */
export function useHorizontalScrollFades(): IHorizontalScrollFades {
  const scrollRef = ref<HTMLElement | null>(null)
  const canScrollLeft = ref(false)
  const canScrollRight = ref(false)
  let resizeObserver: ResizeObserver | null = null

  /**
   * 根据当前滚动位置刷新渐变可见性。
   * @returns void
   */
  function updateScrollFades(): void {
    const element = scrollRef.value
    if (!element) {
      canScrollLeft.value = false
      canScrollRight.value = false
      return
    }
    const maxScroll = element.scrollWidth - element.clientWidth
    if (maxScroll <= 1) {
      canScrollLeft.value = false
      canScrollRight.value = false
      return
    }
    canScrollLeft.value = element.scrollLeft > 1
    canScrollRight.value = element.scrollLeft < maxScroll - 1
  }

  onMounted(() => {
    updateScrollFades()
    const element = scrollRef.value
    if (!element || typeof ResizeObserver === 'undefined') return
    resizeObserver = new ResizeObserver(() => {
      updateScrollFades()
    })
    resizeObserver.observe(element)
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
  })

  return {
    scrollRef,
    canScrollLeft,
    canScrollRight,
    updateScrollFades,
  }
}
