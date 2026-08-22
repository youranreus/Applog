import { nextTick } from 'vue'

export const FLOMO_OVERLAY_CLASS = 'data-open:animate-none data-closed:animate-none'
export const OPEN_MORPH_MS = 440
export const CLOSE_MORPH_MS = 360
export const OPEN_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'
export const CLOSE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'
export const CHROME_FADE_MS = 160
export const CHROME_FADE_DELAY_MS = 120
export const CENTERED_TRANSLATE = '-50% -50%'
export const CENTERED_REST: Keyframe = {
  translate: CENTERED_TRANSLATE,
  scale: '1',
  opacity: 1,
}

const OVERLAY_BLUR = 'blur(4px)'
const OVERLAY_HIDDEN: Keyframe = {
  opacity: 0,
  backdropFilter: 'blur(0px)',
  webkitBackdropFilter: 'blur(0px)',
}
const OVERLAY_VISIBLE: Keyframe = {
  opacity: 1,
  backdropFilter: OVERLAY_BLUR,
  webkitBackdropFilter: OVERLAY_BLUR,
}

/**
 * Locate the teleported Flomo dialog surface.
 * @returns The dialog content element, or null when it is not mounted
 */
export function dialogElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-flomo-note-dialog]')
}

/**
 * Locate the overlay that belongs to the Flomo dialog, not any other Reka overlay.
 * @returns The overlay element, or null when it is not mounted
 */
export function overlayElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '[data-slot="dialog-overlay"]:has(+ [data-flomo-note-dialog])',
  )
}

/**
 * Fade the dim/blur overlay in or out with the card morph.
 * @param direction - Whether the overlay is appearing or disappearing
 * @param duration - Animation duration in milliseconds
 * @param easing - Timing function matching the morph
 * @returns The overlay animation, or null when the overlay is missing
 */
export function fadeOverlay(
  direction: 'in' | 'out',
  duration: number,
  easing: string,
): Animation | null {
  const overlay = overlayElement()
  if (!overlay) return null
  try {
    return overlay.animate(
      direction === 'in' ? [OVERLAY_HIDDEN, OVERLAY_VISIBLE] : [OVERLAY_VISIBLE, OVERLAY_HIDDEN],
      { duration, easing, fill: 'both' },
    )
  } catch {
    overlay.style.opacity = direction === 'in' ? '1' : '0'
    return null
  }
}

/**
 * Collect dialog-only chrome that should fade independently of the card morph.
 * @param element - The dialog content element
 * @returns Header and close-button elements
 */
export function chromeElements(element: HTMLElement): HTMLElement[] {
  return [
    element.querySelector<HTMLElement>('.flomo-dialog__header'),
    element.querySelector<HTMLElement>('[data-slot="dialog-close"]'),
  ].filter((node): node is HTMLElement => node !== null)
}

/**
 * Lock the inner reading pane during morph so overflow does not peek.
 * @param element - The dialog content element
 * @param locked - Whether overflow should be hidden
 */
export function setScrollLocked(element: HTMLElement, locked: boolean): void {
  const scroll = element.querySelector<HTMLElement>('.flomo-dialog__scroll')
  if (scroll) scroll.style.overflowY = locked ? 'hidden' : ''
}

/**
 * Fade dialog chrome in after the morph starts, or out at the start of close.
 * @param element - The dialog content element
 * @param direction - Whether chrome is appearing or disappearing
 */
export function fadeChrome(element: HTMLElement, direction: 'in' | 'out'): void {
  const from = direction === 'in' ? 0 : 1
  const to = direction === 'in' ? 1 : 0
  for (const chrome of chromeElements(element)) {
    try {
      chrome.animate([{ opacity: from }, { opacity: to }], {
        duration: CHROME_FADE_MS,
        delay: direction === 'in' ? CHROME_FADE_DELAY_MS : 0,
        easing: direction === 'in' ? 'ease-out' : 'ease-in',
        fill: 'both',
      })
    } catch {
      chrome.style.opacity = String(to)
    }
  }
}

/**
 * Wait until the teleported dialog has a real layout box before FLIP measurement.
 * The dialog stays visually hidden via the prepare class during these frames.
 * @returns Resolves after two animation frames following the current tick
 */
export async function waitForDialogLayout(): Promise<void> {
  await nextTick()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

/**
 * Build a source-card FLIP keyframe that keeps the Dialog's -50% centering translate.
 * @param element - The laid-out dialog content element
 * @param sourceRect - The originating card rectangle
 * @returns A from/to morph keyframe, or null when geometry is unusable
 */
export function flipKeyframe(element: HTMLElement, sourceRect: DOMRect): Keyframe | null {
  const target = element.getBoundingClientRect()
  if (!target.width || !target.height) return null
  const sourceX = sourceRect.left + sourceRect.width / 2
  const sourceY = sourceRect.top + sourceRect.height / 2
  const targetX = target.left + target.width / 2
  const targetY = target.top + target.height / 2
  const dx = sourceX - targetX
  const dy = sourceY - targetY
  return {
    translate: `calc(-50% + ${dx}px) calc(-50% + ${dy}px)`,
    scale: `${sourceRect.width / target.width} ${sourceRect.height / target.height}`,
    borderRadius: '8px',
    opacity: 1,
  }
}
