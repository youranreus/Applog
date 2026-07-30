<script setup lang="ts">
import { computed } from 'vue'
import { GARMIN_TODAY_STATUS, type GarminTodayStatus } from '@applog/common'

const props = defineProps<{ status: GarminTodayStatus | null }>()
const STATUS_MOTIONS: Record<GarminTodayStatus, string> = {
  [GARMIN_TODAY_STATUS.GREAT]: 'great',
  [GARMIN_TODAY_STATUS.GOOD]: 'good',
  [GARMIN_TODAY_STATUS.ALIVE]: 'alive',
  [GARMIN_TODAY_STATUS.STRUGGLING]: 'struggling',
}
const motion = computed(() => (props.status ? STATUS_MOTIONS[props.status] : 'idle'))
</script>

<template>
  <div class="character-stage" :aria-label="status ? `当前状态：${status}` : '今日状态数据收集中'" role="img">
    <div class="character-shadow" />
    <div class="character" :class="`character--${motion}`">
      <div class="character__head"><i /><i /></div>
      <div class="character__body" />
      <div class="character__arm character__arm--left" />
      <div class="character__arm character__arm--right" />
      <div class="character__leg character__leg--left" />
      <div class="character__leg character__leg--right" />
    </div>
  </div>
</template>

<style scoped>
.character-stage { position: relative; display: grid; min-height: 260px; place-items: center; perspective: 700px; overflow: hidden; border-radius: 16px; background: radial-gradient(circle at 50% 38%, #fff 0 18%, #eaf4ff 55%, #dbeeff 100%); }
.character { --skin: #ffd8b5; --shirt: #147ce5; position: relative; width: 108px; height: 205px; transform-style: preserve-3d; animation: idle 3.2s ease-in-out infinite; }
.character__head, .character__body, .character__arm, .character__leg { position: absolute; transform-style: preserve-3d; box-shadow: inset -10px -8px 18px rgb(0 0 0 / 12%), 0 8px 14px rgb(20 90 150 / 10%); }
.character__head { z-index: 3; top: 5px; left: 29px; width: 52px; height: 56px; border-radius: 42% 42% 48% 48%; background: var(--skin); transform: translateZ(18px); }
.character__head::before { content: ''; position: absolute; inset: 0 0 58% 0; border-radius: 45% 45% 20% 20%; background: #3a2d27; transform: translateZ(3px); }
.character__head i { position: absolute; top: 28px; left: 14px; width: 5px; height: 6px; border-radius: 50%; background: #262626; transform: translateZ(5px); }
.character__head i + i { left: 34px; }
.character__body { z-index: 2; top: 61px; left: 24px; width: 62px; height: 79px; border-radius: 20px 20px 14px 14px; background: linear-gradient(135deg, #4aa3ff, var(--shirt)); transform: translateZ(9px); }
.character__arm { z-index: 1; top: 69px; width: 20px; height: 82px; border-radius: 12px; background: linear-gradient(var(--shirt) 0 55%, var(--skin) 56%); transform-origin: 50% 10%; }
.character__arm--left { left: 9px; transform: rotateZ(8deg) rotateY(-14deg); }
.character__arm--right { right: 7px; transform: rotateZ(-8deg) rotateY(14deg); }
.character__leg { top: 132px; width: 25px; height: 70px; border-radius: 10px 10px 13px 13px; background: linear-gradient(#34506f 0 72%, #fff 73% 87%, #26384f 88%); transform-origin: 50% 5%; }
.character__leg--left { left: 27px; }
.character__leg--right { right: 25px; }
.character-shadow { position: absolute; bottom: 25px; width: 115px; height: 24px; border-radius: 50%; background: rgb(41 91 133 / 20%); filter: blur(7px); animation: shadow 3.2s ease-in-out infinite; }
.character--great { animation-name: celebrate; animation-duration: 1.25s; }
.character--great .character__arm--right { animation: wave .7s ease-in-out infinite alternate; }
.character--good { animation-name: walk; animation-duration: 1.8s; }
.character--good .character__arm--left, .character--good .character__leg--right { animation: stride 1.1s ease-in-out infinite alternate; }
.character--good .character__arm--right, .character--good .character__leg--left { animation: stride 1.1s ease-in-out infinite alternate-reverse; }
.character--alive { animation-name: breathe; animation-duration: 4s; }
.character--struggling { animation-name: tired; animation-duration: 4.8s; }
.character--struggling .character__head { transform: translateZ(18px) rotateX(16deg); }
@keyframes idle { 50% { transform: translateY(-5px) rotateY(5deg); } }
@keyframes celebrate { 50% { transform: translateY(-18px) rotateY(-12deg); } }
@keyframes wave { to { transform: rotateZ(-145deg) rotateY(14deg); } }
@keyframes walk { 50% { transform: translateY(-6px) rotateY(12deg); } }
@keyframes stride { to { transform: rotateZ(24deg); } }
@keyframes breathe { 50% { transform: scale3d(1.025, 1.025, 1.025) rotateY(-5deg); } }
@keyframes tired { 50% { transform: translateY(3px) rotateX(8deg) rotateZ(2deg); } }
@keyframes shadow { 50% { transform: scale(.88); opacity: .65; } }
@media (prefers-reduced-motion: reduce) { .character, .character *, .character-shadow { animation: none !important; } }
</style>
