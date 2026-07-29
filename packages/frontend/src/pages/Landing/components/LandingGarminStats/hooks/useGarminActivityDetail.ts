import type { IGarminLandingActivityDetail } from '@applog/common'
import { shallowReadonly, shallowRef } from 'vue'
import { getGarminActivityDetail } from '@/api/garmin'

const detailCache = new Map<string, IGarminLandingActivityDetail>()

/**
 * 懒加载并在内存中缓存公开 Garmin 活动详情。
 * @returns 当前详情、加载/错误状态与加载动作
 */
export function useGarminActivityDetail() {
  const detail = shallowRef<IGarminLandingActivityDetail | null>(null)
  const loading = shallowRef(false)
  const error = shallowRef(false)
  let requestGeneration = 0

  async function load(publicId: string, force = false): Promise<void> {
    const generation = ++requestGeneration
    const cached = detailCache.get(publicId)
    if (cached && !force) {
      detail.value = cached
      error.value = false
      return
    }
    loading.value = true
    error.value = false
    detail.value = null
    try {
      const response = await getGarminActivityDetail(publicId)
      detailCache.set(publicId, response)
      if (generation === requestGeneration) detail.value = response
    } catch {
      if (generation === requestGeneration) error.value = true
    } finally {
      if (generation === requestGeneration) loading.value = false
    }
  }

  function clear(): void {
    requestGeneration += 1
    detail.value = null
    error.value = false
    loading.value = false
  }

  return {
    detail: shallowReadonly(detail),
    loading: shallowReadonly(loading),
    error: shallowReadonly(error),
    load,
    clear,
  }
}
