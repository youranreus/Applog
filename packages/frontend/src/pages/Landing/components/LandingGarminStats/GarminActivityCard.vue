<script setup lang="ts">
import { CalendarIcon, FlameIcon, MapPinIcon, TimerIcon } from '@lucide/vue'
import { useTemplateRef } from 'vue'
import GarminActivityCover from './GarminActivityCover.vue'
import { usePointerTilt } from './hooks/usePointerTilt'
import type { IGarminActivityView } from './types'

const props = defineProps<{ activity: IGarminActivityView }>()
const emit = defineEmits<{ activate: [activity: IGarminActivityView, element: HTMLElement] }>()
const cardRef = useTemplateRef<HTMLElement>('card')
const { style, onPointerMove, reset } = usePointerTilt()

function activate(): void {
  reset()
  if (cardRef.value && props.activity.publicId && props.activity.route) {
    emit('activate', props.activity, cardRef.value)
  }
}
</script>

<template>
  <component
    :is="activity.route ? 'button' : 'article'"
    ref="card"
    :type="activity.route ? 'button' : undefined"
    class="garmin-card"
    :class="{ 'garmin-card--static': !activity.route }"
    :style="style"
    :aria-label="activity.route ? `查看${activity.typeDisplay}详情` : undefined"
    @pointermove="onPointerMove"
    @pointerleave="reset"
    @blur="reset"
    @click="activate"
  >
    <GarminActivityCover v-if="activity.route" :activity="activity" />
    <span v-if="activity.route" class="garmin-card__body">
      <strong class="garmin-card__title">{{ activity.typeDisplay }}</strong>
      <span class="garmin-card__row">
        <span class="garmin-card__metric">
          <CalendarIcon aria-hidden="true" />
          <time>{{ activity.dateText }}</time>
        </span>
        <span v-if="activity.locationText" class="garmin-card__metric">
          <MapPinIcon aria-hidden="true" />
          <span>{{ activity.locationText }}</span>
        </span>
      </span>
      <span class="garmin-card__row">
        <span v-if="activity.caloriesText" class="garmin-card__metric">
          <FlameIcon aria-hidden="true" />
          <span>{{ activity.caloriesText }}</span>
        </span>
        <span class="garmin-card__metric">
          <TimerIcon aria-hidden="true" />
          <span>{{ activity.durationText }}</span>
        </span>
      </span>
    </span>
    <span v-else class="garmin-card__data">
      <span class="garmin-card__data-header">
        <strong class="garmin-card__title">{{ activity.typeDisplay }}</strong>
        <time>{{ activity.dateText }}</time>
      </span>
      <span class="garmin-card__data-grid">
        <span v-for="metric in activity.cardMetrics" :key="metric.key" class="garmin-card__datum">
          <small>{{ metric.label }}</small>
          <strong>{{ metric.value }}</strong>
        </span>
      </span>
    </span>
  </component>
</template>

<style scoped>
.garmin-card {
  display: flex;
  flex: 0 0 11.5rem;
  min-width: 11.5rem;
  max-width: 11.5rem;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--landing-muted) 18%, transparent);
  border-radius: 8px;
  background: var(--landing-surface);
  color: inherit;
  text-align: left;
  scroll-snap-align: start;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
  transform-style: preserve-3d;
}

.garmin-card:focus-visible {
  outline: 2px solid var(--landing-primary);
  outline-offset: 3px;
}

.garmin-card--static {
  cursor: default;
}

.garmin-card__body {
  display: grid;
  width: 100%;
  grid-template-rows: auto auto auto;
  gap: 0.22rem;
  padding: 0.5rem 0.6rem 0.6rem;
}

.garmin-card__title {
  overflow: hidden;
  color: var(--landing-text);
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.garmin-card__row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
  overflow: hidden;
  color: var(--landing-muted);
  font-size: 0.6875rem;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
}

.garmin-card__metric {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.22rem;
}

.garmin-card__metric span,
.garmin-card__metric time {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.garmin-card__metric svg {
  width: 0.7rem;
  height: 0.7rem;
  flex: none;
}

.garmin-card__data {
  display: flex;
  min-height: 15.9rem;
  flex-direction: column;
  padding: 0.85rem 0.75rem 0.75rem;
}

.garmin-card__data-header {
  display: grid;
  gap: 0.2rem;
}

.garmin-card__data-header time,
.garmin-card__datum small {
  color: var(--landing-muted);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
}

.garmin-card__data-grid {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: end;
  gap: 0.8rem 0.55rem;
  padding-top: 1rem;
}

.garmin-card__datum {
  display: grid;
  min-width: 0;
  gap: 0.16rem;
}

.garmin-card__datum strong {
  overflow: hidden;
  color: var(--landing-text);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .garmin-card {
    flex-basis: 10.75rem;
    min-width: 10.75rem;
    max-width: 10.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .garmin-card {
    transition: none;
  }
}
</style>
