<script setup lang="ts">
import type { IFlomoPublicMemo } from '@applog/common'
import { nextTick, ref, watch } from 'vue'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { IFlomoBox } from '../notes-dialog-motion'
import {
  CHROME_FADE_MS,
  CLOSE_EASING,
  CLOSE_MORPH_MS,
  FLOMO_OVERLAY_CLASS,
  OPEN_EASING,
  OPEN_MORPH_MS,
  applyBox,
  copyBox,
  dialogElement,
  fadeChrome,
  fadeOverlay,
  isolateDialogLayer,
  measureRestBox,
  playBoxMorph,
  setScrollLocked,
  waitForDialogCard,
  waitForFrames,
} from '../notes-dialog-motion'
import { FLOMO_CARD_SLOT_ID, formatFlomoNoteDate, shouldMorphFlomoDialog } from '../notes-utils'

const props = defineProps<{
  open: boolean
  note: IFlomoPublicMemo | null
  sourceRect: DOMRect | null
}>()
const emit = defineEmits<{
  'update:open': [open: boolean]
  'source-released': []
}>()
const closing = ref(false)
const preparing = ref(true)
const savedScrollY = ref(0)

/**
 * Build a source box from the originating card, if geometry is usable.
 * @returns A copied source box, or null when the rect is missing
 */
function sourceBox(): IFlomoBox | null {
  return props.sourceRect ? copyBox(props.sourceRect) : null
}

/**
 * Reveal the dialog immediately when morphing is unavailable.
 * @param element - The laid-out dialog content element, if present
 */
function revealWithoutMorph(element: HTMLElement | null): void {
  fadeOverlay('in', CHROME_FADE_MS, OPEN_EASING)
  if (element) {
    const rest = measureRestBox(element)
    if (rest) applyBox(element, rest)
    isolateDialogLayer(element)
  }
  preparing.value = false
  setScrollLocked(false)
}

/**
 * Expand the teleported source card from its grid box to the centered reading size.
 * @returns Resolves after the open animation finishes or is skipped
 */
async function animateOpen(): Promise<void> {
  preparing.value = true
  const card = await waitForDialogCard()
  const element = dialogElement()
  const from = sourceBox()
  if (!element || !card || !from || !shouldMorphFlomoDialog()) {
    revealWithoutMorph(element)
    return
  }
  try {
    applyBox(element, from)
    setScrollLocked(true)
    const rest = measureRestBox(element)
    applyBox(element, from)
    if (!rest) {
      revealWithoutMorph(element)
      return
    }
    preparing.value = false
    await nextTick()
    await waitForFrames()
    isolateDialogLayer(element)
    fadeOverlay('in', OPEN_MORPH_MS, OPEN_EASING)
    fadeChrome(element, 'in')
    await playBoxMorph(element, from, rest, OPEN_MORPH_MS, OPEN_EASING)
    isolateDialogLayer(element)
    setScrollLocked(false)
  } catch {
    revealWithoutMorph(element)
  }
}

/**
 * Close the dialog, reverse-morphing the same card back to its grid box.
 * @param open - Whether the Dialog requested an open state
 */
async function requestChange(open: boolean): Promise<void> {
  if (open) {
    emit('update:open', true)
    return
  }
  if (closing.value) return
  closing.value = true
  const element = dialogElement()
  const to = sourceBox()
  const overlayAnimation = fadeOverlay('out', CLOSE_MORPH_MS, CLOSE_EASING)
  if (element && to && shouldMorphFlomoDialog()) {
    try {
      setScrollLocked(true)
      fadeChrome(element, 'out')
      const from = copyBox(element.getBoundingClientRect())
      await playBoxMorph(element, from, to, CLOSE_MORPH_MS, CLOSE_EASING)
    } catch {
      // Closing must never be blocked by an incomplete WAAPI implementation.
    }
  } else if (overlayAnimation) {
    try {
      await overlayAnimation.finished
    } catch {
      // Overlay fade cancellation still proceeds to unmount.
    }
  }
  preparing.value = true
  emit('source-released')
  await nextTick()
  window.scrollTo({ top: savedScrollY.value })
  emit('update:open', false)
  closing.value = false
}

watch(
  () => props.open,
  (open, wasOpen) => {
    if (open && !wasOpen) {
      savedScrollY.value = window.scrollY
      void animateOpen()
    }
  },
)
</script>

<template>
  <Dialog :open="open" @update:open="requestChange">
    <DialogContent
      v-if="note"
      data-flomo-note-dialog
      class="flomo-dialog isolate top-0 left-0 z-[51] block w-auto max-w-none p-0 gap-0 bg-transparent translate-x-0 translate-y-0 shadow-none ring-0 transition-none data-open:animate-none data-closed:animate-none"
      :class="{ 'flomo-dialog--prepare': preparing }"
      :overlay-class="FLOMO_OVERLAY_CLASS"
      :show-close-button="true"
    >
      <DialogTitle class="sr-only">
        {{ formatFlomoNoteDate(note.createdAt) }} 的笔记
      </DialogTitle>
      <div :id="FLOMO_CARD_SLOT_ID" class="flomo-dialog__slot" />
    </DialogContent>
  </Dialog>
</template>

<style scoped>
:global(.flomo-dialog) {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  border: 0 !important;
  border-radius: var(--radius-cards);
  background: transparent !important;
  box-shadow: none !important;
  /* translateZ keeps a Safari compositor layer above overlay backdrop-filter. */
  transform: translateZ(0) !important;
  translate: 0 0;
  transform-origin: top left;
  transition: none;
}

:global(.flomo-dialog.flomo-dialog--prepare) {
  opacity: 0;
}

:global([data-slot='dialog-overlay']:has(+ [data-flomo-note-dialog].flomo-dialog--prepare)) {
  pointer-events: none;
  background-color: transparent;
  opacity: 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.flomo-dialog__slot {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

:global(.flomo-dialog [data-slot='dialog-close']) {
  z-index: 1;
}

@media (prefers-reduced-motion: reduce) {
  :global(.flomo-dialog) { animation: none !important; transition: none !important; }
}
</style>
