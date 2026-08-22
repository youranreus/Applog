import { computed, onMounted, ref } from 'vue'
import { useRequest } from 'alova/client'
import type { IFlomoPublicMemo } from '@applog/common'
import { getFlomoNotes } from '@/api/flomo'
import { appendUniqueFlomoNotes } from '../notes-utils'

/** Own public initial/append/retry/end state for the fixed Flomo cursor API. */
export function useFlomoNotes() {
  const notes = ref<IFlomoPublicMemo[]>([])
  const cursor = ref<string | null>(null)
  const loaded = ref(false)
  const requestError = ref<unknown>(null)
  const { loading, send } = useRequest(() => getFlomoNotes(cursor.value ?? undefined), {
    immediate: false,
  })

  const hasMore = computed(() => loaded.value && cursor.value !== null)

  async function load(): Promise<void> {
    if (loading.value) return
    requestError.value = null
    try {
      const page = await send()
      notes.value = appendUniqueFlomoNotes(notes.value, page.items)
      cursor.value = page.nextCursor
      loaded.value = true
    } catch (error) {
      requestError.value = error
    }
  }

  onMounted(() => void load())

  return {
    notes,
    loading,
    loaded,
    error: requestError,
    hasMore,
    loadMore: load,
    retry: load,
  }
}
