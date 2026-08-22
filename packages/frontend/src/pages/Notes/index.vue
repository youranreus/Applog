<script setup lang="ts">
import type { IFlomoPublicMemo } from '@applog/common'
import { computed, nextTick, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { Button } from '@/components/ui/button'
import { useSeoHead } from '@/hooks/useSeoHead'
import FlomoNoteCard from './components/FlomoNoteCard.vue'
import FlomoNoteDialog from './components/FlomoNoteDialog.vue'
import { useFlomoNotes } from './hooks/useFlomoNotes'
import { NOTES_WIDE_MEDIA_QUERY, splitNotesIntoColumns } from './notes-utils'

const { notes, loading, loaded, error, hasMore, loadMore, retry } = useFlomoNotes()
const selected = ref<IFlomoPublicMemo | null>(null)
const dialogOpen = ref(false)
const expandedId = ref<string | null>(null)
const sourceRect = ref<DOMRect | null>(null)
const sourceElement = ref<HTMLElement | null>(null)
const placeholderHeight = ref(0)
const isWide = useMediaQuery(NOTES_WIDE_MEDIA_QUERY)
const noteColumns = computed(() => splitNotesIntoColumns(notes.value, isWide.value ? 2 : 1))

useSeoHead({
  title: '笔记',
  description: '一些短小的想法与记录',
  canonicalPath: '/notes',
})

/**
 * Open a note from its source card after capturing the card rectangle.
 * The dialog slot must exist before Teleport enables, otherwise Vue caches a
 * null target and never re-queries the selector.
 * @param note - The public memo to read
 * @param source - The originating card element
 */
async function openNote(note: IFlomoPublicMemo, source: HTMLElement): Promise<void> {
  selected.value = note
  sourceRect.value = source.getBoundingClientRect()
  sourceElement.value = source
  placeholderHeight.value = sourceRect.value.height
  dialogOpen.value = true
  await nextTick()
  expandedId.value = note.id
}

/**
 * Return the source card to the grid before the dialog unmounts.
 */
function releaseSource(): void {
  expandedId.value = null
}

/**
 * Apply the Dialog open state after a completed close.
 * @param open - Whether the reading dialog should stay open
 */
function setDialogOpen(open: boolean): void {
  dialogOpen.value = open
  if (!open) {
    sourceElement.value?.focus({ preventScroll: true })
    selected.value = null
    sourceRect.value = null
    sourceElement.value = null
    expandedId.value = null
    placeholderHeight.value = 0
  }
}

/** Keep the reader's first visible card stationary when columns rebalance. */
async function loadMoreWithAnchor(): Promise<void> {
  const anchor = Array.from(document.querySelectorAll<HTMLElement>('.note-card'))
    .find((element) => {
      const rect = element.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < window.innerHeight
    })
  const anchorTop = anchor?.getBoundingClientRect().top
  await loadMore()
  await nextTick()
  if (!anchor?.isConnected || anchorTop === undefined) return
  const offset = anchor.getBoundingClientRect().top - anchorTop
  if (Math.abs(offset) > 0.5) window.scrollBy(0, offset)
}
</script>

<template>
  <div class="notes-page common-page-container">
    <header class="notes-page__header">
      <p class="notes-page__eyebrow">Notes</p>
      <h1>笔记</h1>
      <p>短一些，也更接近日常。</p>
    </header>

    <div v-if="notes.length" class="notes-grid" :style="{ '--notes-columns': noteColumns.length }">
      <div
        v-for="(column, columnIndex) in noteColumns"
        :key="columnIndex"
        class="notes-grid__col"
      >
        <div v-for="note in column" :key="note.id" class="note-card-wrap">
          <div
            v-if="expandedId === note.id"
            class="note-card-placeholder"
            :style="{ height: `${placeholderHeight}px` }"
            aria-hidden="true"
          />
          <FlomoNoteCard
            :note="note"
            :expanded="expandedId === note.id"
            @open="openNote"
          />
        </div>
      </div>
    </div>

    <div v-if="loading && !loaded" class="notes-state" role="status">正在整理笔记…</div>
    <div v-else-if="error && !notes.length" class="notes-state" role="alert">
      <p>笔记暂时没有加载出来。</p>
      <Button variant="outline" size="sm" @click="retry">重试</Button>
    </div>
    <div v-else-if="loaded && !notes.length" class="notes-state">这里还没有公开笔记。</div>

    <div v-if="notes.length" class="notes-page__more">
      <Button v-if="hasMore" variant="outline" :disabled="loading" @click="loadMoreWithAnchor">
        {{ loading ? '加载中…' : error ? '重试加载更多' : '加载更多' }}
      </Button>
      <p v-else-if="!loading" class="notes-page__end">已经读到这里了</p>
    </div>

    <FlomoNoteDialog
      :open="dialogOpen"
      :note="selected"
      :source-rect="sourceRect"
      @update:open="setDialogOpen"
      @source-released="releaseSource"
    />
  </div>
</template>

<style scoped>
.notes-page {
  width: 100%;
  padding-top: clamp(3.5rem, 8vh, 7rem);
  padding-bottom: 5rem;
}

.notes-page__header { margin-bottom: 2.5rem; }
.notes-page__eyebrow {
  color: var(--color-link-blue);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.notes-page__header h1 {
  margin-top: 0.35rem;
  font-family: var(--font-heading);
  font-size: clamp(2rem, 1.6rem + 1.5vw, 2.75rem);
  font-weight: 600;
  letter-spacing: -0.035em;
}
.notes-page__header > p:last-child {
  margin-top: 0.55rem;
  color: var(--muted-foreground);
  font-size: 0.9rem;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(var(--notes-columns, 1), minmax(0, 1fr));
  gap: 1rem;
}

.notes-grid__col {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.note-card-wrap { position: relative; min-width: 0; }

.note-card-placeholder {
  width: 100%;
  pointer-events: none;
}

.note-card-wrap:has(.note-card) .note-card-placeholder {
  position: absolute;
  inset: 0;
  height: auto !important;
}

.notes-state {
  display: grid;
  justify-items: center;
  gap: 0.8rem;
  padding: 4rem 0;
  color: var(--muted-foreground);
  text-align: center;
}

.notes-page__more { display: flex; justify-content: center; margin-top: 2rem; }
.notes-page__end { color: var(--muted-foreground); font-size: 0.75rem; }
</style>
