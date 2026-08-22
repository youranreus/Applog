<script setup lang="ts">
import type { IFlomoPublicMemo } from '@applog/common'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { FLOMO_CARD_SLOT_ID, formatFlomoNoteDate, isOverflowing, isScrolledToBottom } from '../notes-utils'
import FlomoContent from './FlomoContent.vue'
import FlomoDisplayTags from './FlomoDisplayTags.vue'

const props = defineProps<{ note: IFlomoPublicMemo; expanded: boolean }>()
const emit = defineEmits<{ open: [note: IFlomoPublicMemo, source: HTMLElement] }>()
const preview = ref<HTMLElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const card = ref<HTMLElement | null>(null)
const overflowing = ref(false)
const atBottom = ref(true)
let observer: ResizeObserver | undefined

const showFade = computed(() => overflowing.value && !(props.expanded && atBottom.value))

/**
 * Measure overflow and whether the inner pane has reached its trailing edge.
 */
function measure(): void {
  const element = props.expanded ? scroller.value : preview.value
  if (!element) {
    overflowing.value = false
    atBottom.value = true
    return
  }
  overflowing.value = isOverflowing(element)
  atBottom.value = isScrolledToBottom(element)
}

/**
 * Bind ResizeObserver to the box that actually clips content in this state.
 */
function observeClip(): void {
  observer?.disconnect()
  const element = props.expanded ? scroller.value : preview.value
  if (element) observer?.observe(element)
}

/**
 * Open the source card into the page-level reading dialog.
 */
function open(): void {
  if (props.expanded) return
  if (card.value) emit('open', props.note, card.value)
}

onMounted(() => {
  observer = new ResizeObserver(() => measure())
  observeClip()
  void nextTick(async () => {
    measure()
    if (document.fonts?.ready) {
      await document.fonts.ready
      measure()
    }
  })
})

watch(() => props.note.contentHtml, () => {
  void nextTick(() => {
    observeClip()
    measure()
  })
})
watch(() => props.expanded, (expanded) => {
  void nextTick(() => {
    if (expanded && scroller.value) scroller.value.scrollTop = 0
    observeClip()
    measure()
  })
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <Teleport
    :disabled="!expanded"
    :to="expanded ? `#${FLOMO_CARD_SLOT_ID}` : undefined"
  >
    <article
      ref="card"
      class="note-card"
      :class="{ 'note-card--expanded': expanded }"
      :role="expanded ? undefined : 'button'"
      :tabindex="expanded ? undefined : 0"
      :aria-label="expanded ? undefined : `打开 ${formatFlomoNoteDate(note.createdAt)} 的笔记`"
      @click="open"
      @keydown.enter="open"
      @keydown.space.prevent="open"
    >
      <div v-if="note.contentHtml" class="note-card__body">
        <div ref="scroller" class="note-card__scroll" @scroll="measure">
          <div ref="preview" class="note-card__preview">
            <FlomoContent :content-html="note.contentHtml" />
          </div>
        </div>
        <div v-if="showFade" class="note-card__fade" aria-hidden="true" />
      </div>
      <footer class="note-card__meta">
        <time :datetime="note.createdAt" class="note-card__date">
          {{ formatFlomoNoteDate(note.createdAt) }}
        </time>
        <FlomoDisplayTags class="note-card__tags" :tags="note.displayTags" />
      </footer>
    </article>
  </Teleport>
</template>

<style scoped>
.note-card {
  --note-card-surface: var(--card);

  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  padding: 1.3rem 1.35rem 1.15rem;
  overflow: hidden;
  border: 1px solid var(--color-pebble);
  border-radius: var(--radius-cards);
  background: var(--note-card-surface);
  cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease;
}

.note-card:hover {
  --note-card-surface: color-mix(in srgb, var(--card) 88%, var(--color-frost));

  border-color: color-mix(in srgb, var(--color-ash) 45%, var(--color-pebble));
  background: var(--note-card-surface);
}

.note-card:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}

.note-card--expanded {
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  cursor: default;
}

.note-card--expanded:hover {
  --note-card-surface: var(--card);

  border-color: var(--color-pebble);
  background: var(--note-card-surface);
}

.note-card__body { position: relative; min-height: 0; }

.note-card--expanded .note-card__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.note-card__scroll { min-height: 0; }

.note-card--expanded .note-card__scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.note-card--expanded .note-card__scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.note-card__preview {
  max-height: 13.5rem;
  overflow: hidden;
}

.note-card--expanded .note-card__preview {
  max-height: none;
  overflow: visible;
}

.note-card__fade {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 4.25rem;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, var(--note-card-surface) 88%);
}

.note-card__meta {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 0.4rem 0.75rem;
  align-items: center;
  margin-top: 1.1rem;
}

.note-card__meta:first-child { margin-top: 0; }

.note-card__date {
  flex-shrink: 0;
  color: var(--muted-foreground);
  font-size: 0.72rem;
  white-space: nowrap;
}

.note-card__tags { min-width: 0; }

@media (prefers-reduced-motion: reduce) {
  .note-card { transition: none; }
}
</style>
