<script setup lang="ts">
import { computed } from 'vue'
import { resolveApiAssetUrl } from '@/utils/api-url'
import ActivityTypeCover from './ActivityTypeCover.vue'
import type { IGarminActivityView } from './types'

const props = defineProps<{ activity: IGarminActivityView }>()

const coverUrl = computed(() =>
  props.activity.cover ? resolveApiAssetUrl(props.activity.cover.url) : null,
)
</script>

<template>
  <div class="garmin-cover">
    <img
      v-if="activity.cover"
      class="garmin-cover__image"
      :src="coverUrl ?? undefined"
      :width="activity.cover.width"
      :height="activity.cover.height"
      :alt="`${activity.typeDisplay}活动封面`"
    />
    <svg
      v-else-if="activity.route"
      class="garmin-cover__route"
      :viewBox="activity.route.viewBox"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      :aria-label="`${activity.typeDisplay}路线预览`"
    >
      <path :d="activity.route.pathData" vector-effect="non-scaling-stroke" />
      <circle
        :cx="activity.route.endpoints.start.x"
        :cy="activity.route.endpoints.start.y"
        r="2.5"
      />
    </svg>
    <ActivityTypeCover v-else :type="activity.type" :type-display="activity.typeDisplay" />
    <span v-if="activity.distanceText" class="garmin-cover__distance">
      {{ activity.distanceText }}
    </span>
  </div>
</template>

<style scoped>
.garmin-cover {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: #15191d;
}

.garmin-cover__image,
.garmin-cover__route {
  display: block;
  width: 100%;
  height: 100%;
}

.garmin-cover__image {
  object-fit: cover;
}

.garmin-cover__route {
  padding: 1.35rem;
}

.garmin-cover__route path {
  fill: none;
  stroke: #dfe5e8;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.75;
}

.garmin-cover__route circle {
  fill: #fff;
}

.garmin-cover__distance {
  position: absolute;
  z-index: 1;
  overflow: hidden;
  background: rgb(16 19 22 / 76%);
  color: #f2f5f6;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(5px);
}

.garmin-cover__distance {
  right: 0.4rem;
  bottom: 0.4rem;
  max-width: calc(100% - 0.8rem);
  padding: 0.16rem 0.4rem;
  border-radius: 5px;
  font-size: 0.625rem;
  font-weight: 600;
}
</style>
