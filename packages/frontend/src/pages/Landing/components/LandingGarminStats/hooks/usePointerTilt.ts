import { computed, onBeforeUnmount, shallowRef, type CSSProperties } from 'vue'

/** Bounded pointer-fine card tilt with deterministic reset behavior. */
export function usePointerTilt() {
  const rotateX = shallowRef(0)
  const rotateY = shallowRef(0)
  const active = shallowRef(false)
  const supportsTilt = window.matchMedia(
    '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
  )

  const style = computed<CSSProperties>(() => ({
    transform: active.value
      ? `perspective(720px) rotateX(${rotateX.value}deg) rotateY(${rotateY.value}deg)`
      : undefined,
    willChange: active.value ? 'transform' : undefined,
  }))

  function onPointerMove(event: PointerEvent): void {
    if (!supportsTilt.matches) return
    const element = event.currentTarget as HTMLElement
    const rect = element.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    rotateX.value = Math.max(-4, Math.min(4, -y * 8))
    rotateY.value = Math.max(-4, Math.min(4, x * 8))
    active.value = true
  }

  function reset(): void {
    active.value = false
    rotateX.value = 0
    rotateY.value = 0
  }

  window.addEventListener('scroll', reset, { passive: true, capture: true })
  onBeforeUnmount(() => window.removeEventListener('scroll', reset, true))

  return { style, onPointerMove, reset }
}
