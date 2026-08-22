import { nextTick } from 'vue'
import { FLOMO_CARD_SLOT_ID } from './notes-utils'

export interface IFlomoBox {
  top: number
  left: number
  width: number
  height: number
}

export const FLOMO_OVERLAY_CLASS = 'data-open:animate-none data-closed:animate-none'
export const OPEN_MORPH_MS = 440
export const CLOSE_MORPH_MS = 360
export const OPEN_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'
export const CLOSE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'
export const CHROME_FADE_MS = 160
export const CHROME_FADE_DELAY_MS = 120

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
 * Copy viewport-relative geometry so later layout changes cannot mutate it.
 * @param rect - A live DOMRect or box snapshot
 * @returns A plain box used for WAAPI keyframes
 */
export function copyBox(rect: Pick<IFlomoBox, keyof IFlomoBox>): IFlomoBox {
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

/**
 * Locate the teleported Flomo dialog surface.
 * @returns The dialog content element, or null when it is not mounted
 */
export function dialogElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-flomo-note-dialog]')
}

/**
 * Locate the source card after it has moved into the dialog slot.
 * @returns The expanding card element, or null when teleport has not finished
 */
export function dialogCardElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`#${FLOMO_CARD_SLOT_ID} .note-card`)
}

/**
 * Locate the inner reading pane that should scroll independently of the footer.
 * @returns The scroll element, or null when the card is not in the dialog
 */
export function dialogScrollElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`#${FLOMO_CARD_SLOT_ID} .note-card__scroll`)
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
 * @returns Close-button elements
 */
export function chromeElements(element: HTMLElement): HTMLElement[] {
  return [element.querySelector<HTMLElement>('[data-slot="dialog-close"]')].filter(
    (node): node is HTMLElement => node !== null,
  )
}

/**
 * Lock the expanding card during morph so overflow does not peek.
 * @param locked - Whether overflow should be hidden
 */
export function setScrollLocked(locked: boolean): void {
  const scroll = dialogScrollElement()
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
 * Wait until the source card has teleported into the dialog slot.
 * Opening enables Teleport only after the slot mounts, so the first tick
 * may still miss the card.
 * @returns The card element, or null when teleport does not complete
 */
export async function waitForDialogCard(): Promise<HTMLElement | null> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await nextTick()
    const card = dialogCardElement()
    if (card) return card
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }
  return dialogCardElement()
}

/**
 * Horizontal inset used by the reading dialog at the current viewport.
 * @returns Pixels of gutter on each side
 */
export function dialogViewportGutter(): number {
  return window.matchMedia('(max-width: 640px)').matches ? 8 : 16
}

/**
 * Apply a viewport-relative box without the shared Dialog centering transform.
 * @param element - The dialog content element
 * @param box - Top/left/width/height in CSS pixels
 */
export function applyBox(element: HTMLElement, box: IFlomoBox): void {
  element.style.top = `${box.top}px`
  element.style.left = `${box.left}px`
  element.style.width = `${box.width}px`
  element.style.height = `${box.height}px`
  element.style.maxWidth = 'none'
  element.style.maxHeight = 'none'
  element.style.transform = 'none'
}

/**
 * Build a WAAPI keyframe from a viewport-relative box.
 * @param box - Top/left/width/height in CSS pixels
 * @returns A keyframe that does not scale inner text
 */
export function boxKeyframe(box: IFlomoBox): Keyframe {
  return {
    top: `${box.top}px`,
    left: `${box.left}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    transform: 'none',
  }
}

/**
 * Animate a box, then commit the end geometry so Vue/CSS cannot snap back.
 * fill `both` applies the source frame immediately and keeps the rest frame.
 * @param element - The dialog content element
 * @param from - Starting viewport box
 * @param to - Ending viewport box
 * @param duration - Animation duration in milliseconds
 * @param easing - Timing function
 */
export async function playBoxMorph(
  element: HTMLElement,
  from: IFlomoBox,
  to: IFlomoBox,
  duration: number,
  easing: string,
): Promise<void> {
  applyBox(element, from)
  try {
    const animation = element.animate([boxKeyframe(from), boxKeyframe(to)], {
      duration,
      easing,
      fill: 'both',
    })
    try {
      await animation.finished
    } catch {
      // Cancelled animations must not unwind the already-applied from-state.
    }
    try {
      animation.commitStyles()
    } catch {
      applyBox(element, to)
    }
    animation.cancel()
  } catch {
    // Incomplete WAAPI still lands on the destination box.
  }
  applyBox(element, to)
}

/**
 * Measure the centered rest box at reading width using the teleported card's content.
 * Temporarily unconstrained so inner scroll does not hide the true content height.
 * @param element - The dialog content element
 * @returns The centered rest box, or null when geometry is unusable
 */
export function measureRestBox(element: HTMLElement): IFlomoBox | null {
  const gutter = dialogViewportGutter()
  const card = dialogCardElement()
  const scroll = dialogScrollElement()
  const previous = {
    cardHeight: card?.style.height ?? '',
    cardOverflow: card?.style.overflow ?? '',
    scrollOverflow: scroll?.style.overflow ?? '',
    scrollFlex: scroll?.style.flex ?? '',
  }
  if (card) {
    card.style.height = 'auto'
    card.style.overflow = 'visible'
  }
  if (scroll) {
    scroll.style.overflow = 'visible'
    scroll.style.flex = 'none'
  }
  element.style.width = gutter === 8 ? 'calc(100vw - 1rem)' : 'min(46rem, calc(100vw - 2rem))'
  element.style.height = 'auto'
  element.style.maxWidth = 'none'
  element.style.maxHeight = `calc(100dvh - ${gutter * 2}px)`
  element.style.top = '0px'
  element.style.left = '0px'
  element.style.transform = 'none'
  const width = element.getBoundingClientRect().width
  const maxHeight = window.innerHeight - gutter * 2
  const height = Math.min(element.scrollHeight, maxHeight)
  if (card) {
    card.style.height = previous.cardHeight
    card.style.overflow = previous.cardOverflow
  }
  if (scroll) {
    scroll.style.overflow = previous.scrollOverflow
    scroll.style.flex = previous.scrollFlex
  }
  if (!width || !height) return null
  return {
    width,
    height,
    left: (window.innerWidth - width) / 2,
    top: (window.innerHeight - height) / 2,
  }
}
