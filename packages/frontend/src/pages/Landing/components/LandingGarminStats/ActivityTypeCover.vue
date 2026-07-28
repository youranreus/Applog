<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'ActivityTypeCover',
})

const props = defineProps<{
  type: string
  typeDisplay: string
}>()

type CoverKind =
  | 'elliptical'
  | 'soccer'
  | 'treadmill'
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'strength'
  | 'default'

/**
 * 将 Garmin 活动类型映射到静态封面插画种类。
 * @param type - 归一化后的活动 type
 * @returns 封面种类
 */
function resolveCoverKind(type: string): CoverKind {
  const normalized = type.trim().toLowerCase()
  if (normalized === 'elliptical') return 'elliptical'
  if (normalized === 'soccer') return 'soccer'
  if (normalized.includes('treadmill')) return 'treadmill'
  if (
    normalized.includes('run') ||
    normalized === 'walking' ||
    normalized === 'hiking'
  ) {
    return 'running'
  }
  if (normalized.includes('cycl') || normalized.includes('bik')) return 'cycling'
  if (normalized.includes('swim')) return 'swimming'
  if (
    normalized.includes('strength') ||
    normalized === 'cardio' ||
    normalized === 'yoga'
  ) {
    return 'strength'
  }
  return 'default'
}

const coverKind = computed(() => resolveCoverKind(props.type))
const ariaLabel = computed(() => `${props.typeDisplay}活动封面`)
</script>

<template>
  <svg
    class="activity-type-cover"
    viewBox="0 0 24 24"
    role="img"
    :aria-label="ariaLabel"
  >
    <rect class="activity-type-cover__ground" width="24" height="24" />

    <!-- Sports glyphs adapted from Tabler Icons v3.45.0 (MIT). -->
    <g v-if="coverKind === 'elliptical'" class="activity-type-cover__ink">
      <path d="M10 3a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
      <path d="M3 14l4 1l.5 -.5" />
      <path d="M12 18v-3l-3 -2.923l.75 -5.077" />
      <path d="M6 10v-2l4 -1l2.5 2.5l2.5 .5" />
      <path d="M21 22a1 1 0 0 0 -1 -1h-16a1 1 0 0 0 -1 1" />
      <path d="M18 21l1 -11l2 -1" />
    </g>

    <g v-else-if="coverKind === 'soccer'" class="activity-type-cover__ink">
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
      <path d="M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55l4.76 -3.45" />
      <path
        d="M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45"
      />
    </g>

    <g v-else-if="coverKind === 'treadmill'" class="activity-type-cover__ink">
      <path d="M10 3a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
      <path d="M3 14l4 1l.5 -.5" />
      <path d="M12 18v-3l-3 -2.923l.75 -5.077" />
      <path d="M6 10v-2l4 -1l2.5 2.5l2.5 .5" />
      <path d="M21 22a1 1 0 0 0 -1 -1h-16a1 1 0 0 0 -1 1" />
      <path d="M18 21l1 -11l2 -1" />
    </g>

    <g v-else-if="coverKind === 'running'" class="activity-type-cover__ink">
      <path d="M11.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M4 17l5 1l.75 -1.5" />
      <path d="M15 21v-4l-4 -3l1 -6" />
      <path d="M7 12v-3l5 -1l3 3l3 1" />
    </g>

    <g v-else-if="coverKind === 'cycling'" class="activity-type-cover__ink">
      <path d="M2 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
      <path d="M16 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
      <path d="M12 19v-4l-3 -3l5 -4l2 3h3" />
      <path d="M13.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    </g>

    <g v-else-if="coverKind === 'swimming'" class="activity-type-cover__ink">
      <path d="M15 9a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M6 11l4 -2l3.5 3l-1.5 2" />
      <path
        d="M3 16.75a2.4 2.4 0 0 0 1 .25a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 1 -.25"
      />
    </g>

    <g v-else-if="coverKind === 'strength'" class="activity-type-cover__ink">
      <path d="M2 12h1" />
      <path d="M6 8h-2a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1h2" />
      <path d="M6 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1" />
      <path d="M9 12h6" />
      <path d="M15 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1" />
      <path d="M18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-2" />
      <path d="M22 12h-1" />
    </g>

    <g v-else class="activity-type-cover__ink">
      <path d="M3 12h4l3 8l4 -16l3 8h4" />
    </g>
  </svg>
</template>

<style scoped>
.activity-type-cover {
  display: block;
  width: 100%;
  height: 100%;
}

.activity-type-cover__ground {
  fill: var(--landing-surface-soft);
}

.activity-type-cover__ink {
  fill: none;
  stroke: color-mix(in srgb, var(--landing-muted) 62%, var(--landing-text));
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.35;
}
</style>
