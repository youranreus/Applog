import { onBeforeUnmount } from 'vue'

const DURATION_MS = 320

function canAnimate(source: HTMLElement | null, destination: HTMLElement | null): boolean {
  const isVisible = (element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect()
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.top < window.innerHeight
    )
  }
  return Boolean(
    source &&
      destination &&
      source.isConnected &&
      destination.isConnected &&
      isVisible(source) &&
      isVisible(destination) &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
}

function animateClone(source: HTMLElement, from: DOMRect, to: DOMRect): Animation {
  const clone = source.cloneNode(true) as HTMLElement
  Object.assign(clone.style, {
    position: 'fixed',
    inset: 'auto',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: '0',
    zIndex: '80',
    pointerEvents: 'none',
    transformOrigin: 'top left',
  })
  clone.setAttribute('aria-hidden', 'true')
  document.body.append(clone)
  const animation = clone.animate(
    [
      { transform: 'translate(0, 0) scale(1)', borderRadius: '8px', opacity: 1 },
      {
        transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`,
        borderRadius: '6px',
        opacity: 1,
      },
    ],
    { duration: DURATION_MS, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'both' },
  )
  void animation.finished.then(
    () => clone.remove(),
    () => clone.remove(),
  )
  return animation
}

/** WAAPI visual-clone transition that never owns dialog state or focus. */
export function useSharedElementTransition() {
  let current: Animation | null = null

  function open(source: HTMLElement | null, destination: HTMLElement | null): void {
    current?.cancel()
    if (!canAnimate(source, destination) || !source || !destination) return
    current = animateClone(
      source,
      source.getBoundingClientRect(),
      destination.getBoundingClientRect(),
    )
  }

  function close(source: HTMLElement | null, destination: HTMLElement | null): void {
    current?.cancel()
    if (!canAnimate(source, destination) || !source || !destination) return
    current = animateClone(
      source,
      source.getBoundingClientRect(),
      destination.getBoundingClientRect(),
    )
  }

  function cancel(): void {
    current?.cancel()
    current = null
  }

  window.addEventListener('resize', cancel, { passive: true })
  onBeforeUnmount(() => {
    cancel()
    window.removeEventListener('resize', cancel)
  })
  return { open, close, cancel }
}
