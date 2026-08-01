<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import type { GarminTodayStatus } from '@applog/common'
import {
  FEIBI_ACTIONS,
  getFeibiAction,
  getFeibiBackgroundPosition,
  getNextFeibiFrame,
} from './feibi-sprite'

const props = defineProps<{ status: GarminTodayStatus | null }>()

type SpriteVisualState = 'loading' | 'ready' | 'failed'

const SPRITESHEET_URL = `${import.meta.env.BASE_URL}feibi-v1/spritesheet.webp`
const IDLE_INTERVAL_MS = 7000
const visualState = shallowRef<SpriteVisualState>('loading')
const frame = shallowRef(0)
const prefersReducedMotion = shallowRef(false)
const isHovered = shallowRef(false)
const isPlaying = shallowRef(false)
const action = computed(() => getFeibiAction(props.status))
const spriteStyle = computed(() => ({
  backgroundImage: `url("${SPRITESHEET_URL}")`,
  backgroundPosition: getFeibiBackgroundPosition(FEIBI_ACTIONS[action.value].row, frame.value),
}))

let animationTimer: ReturnType<typeof setTimeout> | undefined
let idleTimer: ReturnType<typeof setTimeout> | undefined
let mediaQuery: MediaQueryList | undefined
let preloader: HTMLImageElement | undefined

function clearTimers() {
  if (animationTimer !== undefined) {
    clearTimeout(animationTimer)
    animationTimer = undefined
  }
  if (idleTimer !== undefined) {
    clearTimeout(idleTimer)
    idleTimer = undefined
  }
}

function scheduleIdleAnimation() {
  if (
    visualState.value !== 'ready'
    || prefersReducedMotion.value
    || isHovered.value
    || isPlaying.value
  ) return

  idleTimer = setTimeout(playAction, IDLE_INTERVAL_MS)
}

function scheduleFrame() {
  const currentAction = action.value
  const currentFrame = frame.value
  const duration = FEIBI_ACTIONS[currentAction].frameDurations[currentFrame]

  animationTimer = setTimeout(() => {
    const nextFrame = getNextFeibiFrame(currentAction, currentFrame)
    if (nextFrame === 0) {
      frame.value = 0
      isPlaying.value = false
      if (isHovered.value) {
        playAction()
      } else {
        scheduleIdleAnimation()
      }
      return
    }

    frame.value = nextFrame
    scheduleFrame()
  }, duration)
}

function playAction() {
  clearTimers()
  if (visualState.value !== 'ready' || prefersReducedMotion.value) return

  frame.value = 0
  isPlaying.value = true
  scheduleFrame()
}

function resetToStillFrame() {
  clearTimers()
  frame.value = 0
  isPlaying.value = false
}

function handleMouseEnter() {
  isHovered.value = true
  playAction()
}

function handleMouseLeave() {
  isHovered.value = false
  resetToStillFrame()
  scheduleIdleAnimation()
}

function updateMotionPreference(event: MediaQueryListEvent | MediaQueryList) {
  prefersReducedMotion.value = event.matches
}

function preloadSprite() {
  const image = new Image()
  preloader = image

  image.onload = () => {
    if (preloader !== image) return
    visualState.value = 'ready'
    if (isHovered.value) {
      playAction()
    } else {
      scheduleIdleAnimation()
    }
  }
  image.onerror = () => {
    if (preloader !== image) return
    visualState.value = 'failed'
    resetToStillFrame()
  }
  image.src = SPRITESHEET_URL
}

watch(
  action,
  () => {
    resetToStillFrame()
    scheduleIdleAnimation()
  },
  { flush: 'sync' },
)

watch(prefersReducedMotion, (reducedMotion) => {
  resetToStillFrame()
  if (reducedMotion) {
    return
  }
  if (isHovered.value) {
    playAction()
  } else {
    scheduleIdleAnimation()
  }
})

onMounted(() => {
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  updateMotionPreference(mediaQuery)
  mediaQuery.addEventListener('change', updateMotionPreference)
  preloadSprite()
})

onBeforeUnmount(() => {
  clearTimers()
  mediaQuery?.removeEventListener('change', updateMotionPreference)
  if (preloader) {
    preloader.onload = null
    preloader.onerror = null
    preloader = undefined
  }
})
</script>

<template>
  <div
    class="character-stage"
    :aria-label="status ? `当前状态：${status}` : '今日状态数据收集中'"
    role="img"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div v-if="visualState === 'ready'" class="character-sprite" :style="spriteStyle" aria-hidden="true" />
    <div v-else class="character-fallback" aria-hidden="true" />
  </div>
</template>

<style scoped>
.character-stage {
  position: relative;
  display: grid;
  min-height: 224px;
  place-items: center;
  isolation: isolate;
}

.character-stage::before {
  position: absolute;
  inset: 12% 8% 7%;
  z-index: -1;
  content: '';
  background: radial-gradient(ellipse at 50% 58%, color-mix(in srgb, var(--color-signal-blue) 10%, transparent), transparent 66%);
}

.character-sprite,
.character-fallback {
  width: min(100%, 196px);
  aspect-ratio: 192 / 208;
}

.character-sprite {
  background-repeat: no-repeat;
  background-size: 800% 900%;
}

.character-fallback {
  position: relative;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--landing-muted) 22%, transparent);
  border-radius: 42% 42% 36% 36%;
  background: linear-gradient(145deg, color-mix(in srgb, white 90%, var(--color-signal-blue)), color-mix(in srgb, var(--color-signal-blue) 14%, white));
  box-shadow: inset 0 -18px 28px rgb(20 90 150 / 8%), 0 12px 28px rgb(20 90 150 / 9%);
}

.character-fallback::before {
  position: absolute;
  top: 29%;
  left: 22%;
  width: 56%;
  height: 29%;
  border: 1px solid color-mix(in srgb, var(--landing-muted) 20%, transparent);
  border-radius: 30%;
  content: '';
  background: color-mix(in srgb, var(--color-signal-blue) 12%, white);
  box-shadow: inset 0 0 0 8px rgb(255 255 255 / 36%);
}

.character-fallback::after {
  position: absolute;
  top: 40%;
  left: 37%;
  width: 26%;
  height: 5%;
  border-radius: 999px;
  content: '';
  background: color-mix(in srgb, var(--color-signal-blue) 50%, white);
}

@media (max-width: 800px) {
  .character-stage {
    min-height: 204px;
  }

  .character-stage::before {
    inset-inline: 16%;
  }

  .character-sprite,
  .character-fallback {
    width: min(100%, 176px);
  }
}
</style>
