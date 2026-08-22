<script setup lang="ts">
import type { IFlomoPublicMemo } from '@applog/common'
import { nextTick, ref, watch } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import FlomoContent from './FlomoContent.vue'
import FlomoDisplayTags from './FlomoDisplayTags.vue'
import { formatFlomoNoteDate, shouldMorphFlomoDialog } from '../notes-utils'
import {
  CENTERED_REST,
  CHROME_FADE_MS,
  CLOSE_EASING,
  CLOSE_MORPH_MS,
  FLOMO_OVERLAY_CLASS,
  OPEN_EASING,
  OPEN_MORPH_MS,
  dialogElement,
  fadeChrome,
  fadeOverlay,
  flipKeyframe,
  setScrollLocked,
  waitForDialogLayout,
} from '../notes-dialog-motion'

const props = defineProps<{
  open: boolean
  note: IFlomoPublicMemo | null
  sourceRect: DOMRect | null
  sourceElement: HTMLElement | null
}>()
const emit = defineEmits<{
  'update:open': [open: boolean]
  'source-hidden': [hidden: boolean]
}>()
const closing = ref(false)
const preparing = ref(true)
const savedScrollY = ref(0)

/**
 * Reveal the dialog immediately when morphing is unavailable.
 * @param element - The laid-out dialog content element, if present
 */
function revealWithoutMorph(element: HTMLElement | null): void {
  fadeOverlay('in', CHROME_FADE_MS, OPEN_EASING)
  preparing.value = false
  emit('source-hidden', true)
  if (element) setScrollLocked(element, false)
}

/**
 * Morph the dialog from the source card without replacing its centering translate.
 * @returns Resolves after the open animation finishes or is skipped
 */
async function animateOpen(): Promise<void> {
  preparing.value = true
  await waitForDialogLayout()
  const element = dialogElement()
  const from =
    element && props.sourceRect && shouldMorphFlomoDialog()
      ? flipKeyframe(element, props.sourceRect)
      : null
  if (!element || !from) {
    revealWithoutMorph(element)
    return
  }
  try {
    setScrollLocked(element, true)
    fadeOverlay('in', OPEN_MORPH_MS, OPEN_EASING)
    const animation = element.animate([from, CENTERED_REST], {
      duration: OPEN_MORPH_MS,
      easing: OPEN_EASING,
      fill: 'backwards',
    })
    fadeChrome(element, 'in')
    preparing.value = false
    emit('source-hidden', true)
    try {
      await animation.finished
    } catch {
      // Cancelled animations must not unwind the already-applied from-state.
    }
    setScrollLocked(element, false)
  } catch {
    revealWithoutMorph(element)
  }
}

/**
 * Close the dialog, reverse-morphing when enhancement is available.
 * @param open - Whether the Dialog requested an open state
 */
async function requestChange(open: boolean): Promise<void> {
  if (open) {
    emit('update:open', true)
    return
  }
  if (closing.value) return
  closing.value = true
  const sourceElement = props.sourceElement
  const element = dialogElement()
  const to =
    element && props.sourceRect && shouldMorphFlomoDialog()
      ? flipKeyframe(element, props.sourceRect)
      : null
  const overlayAnimation = fadeOverlay('out', CLOSE_MORPH_MS, CLOSE_EASING)
  if (element && to) {
    try {
      setScrollLocked(element, true)
      fadeChrome(element, 'out')
      const closeAnimation = element.animate([CENTERED_REST, to], {
        duration: CLOSE_MORPH_MS,
        easing: CLOSE_EASING,
        fill: 'forwards',
      })
      try {
        await closeAnimation.finished
      } catch {
        // Closing must never be blocked by a cancelled animation.
      }
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
  emit('update:open', false)
  emit('source-hidden', false)
  await nextTick()
  window.scrollTo({ top: savedScrollY.value })
  sourceElement?.focus({ preventScroll: true })
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
      class="flomo-dialog !w-[calc(100vw-2rem)] !max-w-[46rem] data-open:animate-none data-closed:animate-none"
      :class="{ 'flomo-dialog--prepare': preparing }"
      :overlay-class="FLOMO_OVERLAY_CLASS"
      :show-close-button="true"
    >
      <header class="flomo-dialog__header">
        <DialogTitle>笔记</DialogTitle>
        <DialogDescription>{{ formatFlomoNoteDate(note.createdAt) }}</DialogDescription>
      </header>
      <div class="flomo-dialog__scroll">
        <FlomoContent v-if="note.contentHtml" :content-html="note.contentHtml" />
        <FlomoDisplayTags class="flomo-dialog__tags" :tags="note.displayTags" />
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
:global(.flomo-dialog) {
  display: flex;
  flex-direction: column;
  width: min(46rem, calc(100vw - 2rem)) !important;
  max-width: 46rem !important;
  max-height: calc(100dvh - 2rem);
  gap: 0;
  padding: 0;
  overflow: hidden;
  border: 0 !important;
  border-radius: var(--radius-cards);
  box-shadow: none !important;
  transform-origin: center;
}

:global(.flomo-dialog.flomo-dialog--prepare) {
  opacity: 0;
}

:global([data-slot='dialog-overlay']:has(+ [data-flomo-note-dialog].flomo-dialog--prepare)) {
  background-color: transparent;
  opacity: 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.flomo-dialog__header {
  flex: none;
  padding: 1.25rem 3.25rem 0.65rem 1.5rem;
}

.flomo-dialog__header :deep([data-slot='dialog-description']) { margin-top: 0.35rem; }

.flomo-dialog__scroll {
  min-height: 0;
  overflow-y: auto;
  padding: 0.85rem 1.5rem 1.5rem;
}

.flomo-dialog__tags:not(:first-child) { margin-top: 1.5rem; }

@media (max-width: 640px) {
  :global(.flomo-dialog) {
    width: calc(100vw - 1rem) !important;
    max-height: calc(100dvh - 1rem);
  }
  .flomo-dialog__scroll { padding: 1.25rem; }
}

@media (prefers-reduced-motion: reduce) {
  :global(.flomo-dialog) { animation: none !important; transition: none !important; }
}
</style>
