<script setup lang="ts">
import type { IGarminLandingActivityDetail } from '@applog/common'
import { RefreshCwIcon } from '@lucide/vue'
import { computed } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import GarminActivityCover from './GarminActivityCover.vue'
import type { IGarminActivityView } from './types'
import { formatDuration, formatDistance, formatPace, getGarminMetricGroups } from './utils'

const props = defineProps<{
  open: boolean
  activity: IGarminActivityView | null
  detail: IGarminLandingActivityDetail | null
  loading: boolean
  error: boolean
}>()
const emit = defineEmits<{
  updateOpen: [open: boolean]
  retry: []
}>()

const metrics = computed(() =>
  props.activity
    ? getGarminMetricGroups(props.activity.summary, props.detail)
    : { core: [], secondary: [] },
)
</script>

<template>
  <Dialog :open="open" @update:open="emit('updateOpen', $event)">
    <DialogContent
      v-if="activity"
      class="garmin-detail !w-[calc(100vw-2rem)] !max-w-[62rem] max-[800px]:!w-[calc(100vw-1rem)] max-[800px]:!max-w-none"
      :show-close-button="true"
    >
      <div class="garmin-detail__layout">
        <div class="garmin-detail__media" data-garmin-detail-media>
          <GarminActivityCover :activity="activity" />
        </div>

        <div class="garmin-detail__content">
          <header class="garmin-detail__header">
            <DialogDescription class="garmin-detail__date">
              {{ activity.dateText }}
            </DialogDescription>
            <DialogTitle class="garmin-detail__title">
              {{ activity.typeDisplay }}
            </DialogTitle>
          </header>

          <dl class="garmin-detail__core">
            <div v-for="item in metrics.core" :key="item.key">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>

          <div v-if="loading" class="garmin-detail__loading" aria-live="polite">
            <span class="sr-only">正在加载活动详情</span>
            <span v-for="index in 4" :key="index" />
          </div>

          <div v-else-if="error" class="garmin-detail__error" role="status">
            <p>详细指标暂时不可用</p>
            <Button variant="ghost" size="sm" @click="emit('retry')">
              <RefreshCwIcon aria-hidden="true" />
              重试
            </Button>
          </div>

          <dl v-else-if="metrics.secondary.length" class="garmin-detail__secondary">
            <div v-for="item in metrics.secondary" :key="item.key">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>

          <section
            v-if="activity.type === 'track_running' && detail?.splits.length"
            class="garmin-detail__splits"
            aria-labelledby="garmin-splits-title"
          >
            <h3 id="garmin-splits-title">分段</h3>
            <ol>
              <li v-for="split in detail.splits.slice(0, 6)" :key="split.index">
                <span>第 {{ split.index }} 段</span>
                <span>{{ formatDistance(split.distanceMeters) ?? '—' }}</span>
                <span>{{
                  split.durationSeconds === null ? '—' : formatDuration(split.durationSeconds)
                }}</span>
                <span>{{ formatPace(split.averagePaceSecondsPerKm) ?? '—' }}</span>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
:deep(.garmin-detail) {
  width: min(62rem, calc(100vw - 2rem)) !important;
  max-width: 62rem !important;
  max-height: min(46rem, calc(100dvh - 2rem));
  padding: 0;
  overflow: hidden auto;
  border-radius: 8px;
}

.garmin-detail__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  min-height: 30rem;
}

.garmin-detail__media {
  align-self: stretch;
  background: #15191d;
}

.garmin-detail__media :deep(.garmin-cover) {
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
}

.garmin-detail__content {
  min-width: 0;
  padding: 2.5rem 2.25rem 2rem;
}

.garmin-detail__date {
  color: var(--landing-muted);
  font-size: 0.75rem;
}

.garmin-detail__title {
  margin-top: 0.35rem;
  color: var(--landing-text);
  font-family: var(--landing-font-heading);
  font-size: 1.75rem;
  font-weight: 600;
}

.garmin-detail__core {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem 1rem;
  margin-top: 2rem;
}

.garmin-detail__core dt,
.garmin-detail__secondary dt {
  color: var(--landing-muted);
  font-size: 0.6875rem;
}

.garmin-detail__core dd {
  margin-top: 0.2rem;
  color: var(--landing-text);
  font-size: 1.35rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.garmin-detail__secondary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem 1rem;
  margin-top: 1.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid color-mix(in srgb, var(--landing-muted) 15%, transparent);
}

.garmin-detail__secondary dd {
  margin-top: 0.15rem;
  color: var(--landing-text);
  font-size: 0.9375rem;
  font-variant-numeric: tabular-nums;
}

.garmin-detail__loading {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-top: 1.75rem;
}

.garmin-detail__loading span:not(.sr-only) {
  height: 2.5rem;
  border-radius: 5px;
  background: color-mix(in srgb, var(--landing-muted) 12%, transparent);
}

.garmin-detail__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 1.75rem;
  color: var(--landing-muted);
  font-size: 0.8125rem;
}

.garmin-detail__splits {
  margin-top: 1.5rem;
}

.garmin-detail__splits h3 {
  color: var(--landing-text);
  font-size: 0.8125rem;
  font-weight: 600;
}

.garmin-detail__splits ol {
  margin-top: 0.5rem;
}

.garmin-detail__splits li {
  display: grid;
  grid-template-columns: minmax(4rem, 1fr) repeat(3, minmax(0, auto));
  gap: 0.75rem;
  padding: 0.4rem 0;
  color: var(--landing-muted);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 800px) {
  :deep(.garmin-detail) {
    width: calc(100vw - 1rem) !important;
    max-width: none !important;
    max-height: calc(100dvh - 1rem);
  }

  .garmin-detail__layout {
    display: block;
    min-height: 0;
  }

  .garmin-detail__media {
    aspect-ratio: 16 / 10;
  }

  .garmin-detail__content {
    padding: 1.5rem 1.25rem 1.75rem;
  }

  .garmin-detail__splits li {
    gap: 0.45rem;
  }
}

@media (max-width: 440px) {
  .garmin-detail__splits li {
    grid-template-columns: 1fr auto;
  }
}
</style>
