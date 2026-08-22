<script setup lang="ts">
import type { IFlomoPublicMemo } from '@applog/common'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FlomoContent from './FlomoContent.vue'
import FlomoDisplayTags from './FlomoDisplayTags.vue'
import { formatFlomoNoteDate } from '../notes-utils'

const props = defineProps<{ note: IFlomoPublicMemo; active: boolean }>()
const emit = defineEmits<{ open: [note: IFlomoPublicMemo, source: HTMLElement] }>()
const preview = ref<HTMLElement | null>(null)
const card = ref<HTMLElement | null>(null)
const overflowing = ref(false)
let observer: ResizeObserver | undefined

/**
 * Measure whether the trusted HTML preview actually overflows its clamp.
 */
function measure(): void {
  const element = preview.value
  overflowing.value = Boolean(element && element.scrollHeight > element.clientHeight + 1)
}

/**
 * Bind ResizeObserver to the current preview box after contentHtml mounts or changes.
 */
function observePreview(): void {
  observer?.disconnect()
  if (preview.value) observer?.observe(preview.value)
}

/**
 * Open the source card into the page-level reading dialog.
 */
function open(): void {
  if (card.value) emit('open', props.note, card.value)
}

onMounted(() => {
  observer = new ResizeObserver(() => measure())
  observePreview()
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
    observePreview()
    measure()
  })
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <article
    ref="card"
    class="note-card"
    :class="{ 'note-card--active': active }"
    role="button"
    tabindex="0"
    :aria-label="`打开 ${formatFlomoNoteDate(note.createdAt)} 的笔记`"
    @click="open"
    @keydown.enter="open"
    @keydown.space.prevent="open"
  >
    <div v-if="note.contentHtml" class="note-card__body">
      <div ref="preview" class="note-card__preview">
        <FlomoContent :content-html="note.contentHtml" />
      </div>
      <div v-if="overflowing" class="note-card__fade" aria-hidden="true" />
    </div>
    <footer class="note-card__meta">
      <time :datetime="note.createdAt" class="note-card__date">
        {{ formatFlomoNoteDate(note.createdAt) }}
      </time>
      <FlomoDisplayTags class="note-card__tags" :tags="note.displayTags" />
    </footer>
  </article>
</template>

<style scoped>
.note-card {
  --note-card-surface: var(--card);

  display: inline-block;
  width: 100%;
  min-width: 0;
  margin-bottom: 1rem;
  padding: 1.3rem 1.35rem 1.15rem;
  break-inside: avoid;
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

.note-card--active { visibility: hidden; }

.note-card__body { position: relative; }

.note-card__preview {
  max-height: 13.5rem;
  overflow: hidden;
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
