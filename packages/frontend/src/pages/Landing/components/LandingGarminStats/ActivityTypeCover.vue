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
    viewBox="0 0 160 100"
    role="img"
    :aria-label="ariaLabel"
  >
    <rect
      class="activity-type-cover__ground"
      x="0"
      y="0"
      width="160"
      height="100"
      rx="0"
    />

    <g v-if="coverKind === 'elliptical'" class="activity-type-cover__ink">
      <ellipse cx="80" cy="62" rx="46" ry="14" />
      <path d="M48 62 Q80 28 112 62" />
      <circle cx="52" cy="62" r="5" />
      <circle cx="108" cy="62" r="5" />
      <path d="M72 34 L88 34 M80 34 L80 52" />
    </g>

    <g v-else-if="coverKind === 'soccer'" class="activity-type-cover__ink">
      <circle cx="80" cy="50" r="24" />
      <path d="M80 26 L92 36 L88 52 L72 52 L68 36 Z" />
      <path d="M68 36 L52 42 M92 36 L108 42 M72 52 L60 70 M88 52 L100 70" />
    </g>

    <g v-else-if="coverKind === 'treadmill'" class="activity-type-cover__ink">
      <path d="M36 70 H124" />
      <path d="M44 70 L52 40 H108 L116 70" />
      <path d="M60 40 V28 H100" />
      <path d="M68 54 H92" />
    </g>

    <g v-else-if="coverKind === 'running'" class="activity-type-cover__ink">
      <path d="M48 72 C68 48 92 48 112 72" />
      <circle cx="70" cy="34" r="6" />
      <path d="M70 40 L78 54 L66 68 M78 54 L96 48 M66 68 L58 82 M78 54 L84 78" />
    </g>

    <g v-else-if="coverKind === 'cycling'" class="activity-type-cover__ink">
      <circle cx="52" cy="62" r="14" />
      <circle cx="108" cy="62" r="14" />
      <path d="M52 62 L78 38 L104 62 M78 38 L78 28 M78 38 L96 38" />
    </g>

    <g v-else-if="coverKind === 'swimming'" class="activity-type-cover__ink">
      <path d="M30 58 Q50 48 70 58 T110 58 T150 58" />
      <path d="M30 70 Q50 60 70 70 T110 70 T150 70" />
      <circle cx="68" cy="40" r="5" />
      <path d="M68 45 L78 52 L92 48 M78 52 L74 62" />
    </g>

    <g v-else-if="coverKind === 'strength'" class="activity-type-cover__ink">
      <path d="M40 50 H120" />
      <path d="M48 38 V62 M112 38 V62" />
      <path d="M40 42 V58 M32 42 V58 M120 42 V58 M128 42 V58" />
    </g>

    <g v-else class="activity-type-cover__ink">
      <circle cx="80" cy="42" r="10" />
      <path d="M80 54 V72 M64 60 H96 M68 88 L80 72 L92 88" />
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
  stroke: color-mix(in srgb, var(--landing-muted) 72%, var(--landing-text));
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.25;
}

.activity-type-cover__ink circle,
.activity-type-cover__ink ellipse {
  fill: none;
}
</style>
