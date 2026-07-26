<script setup lang="ts">
import { ClockIcon, CloudSunIcon, UsersIcon } from '@lucide/vue';
import type { ICurrentWeatherDto } from '@/types/weather';

defineProps<{
  weather: ICurrentWeatherDto | null;
  onlineVisitors: number | null;
  uptimeText: string | null;
}>();
</script>

<template>
  <section
    v-if="weather || onlineVisitors !== null || uptimeText"
    class="landing-meta"
    aria-label="站点状态"
  >
    <div v-if="weather" class="landing-meta__item">
      <CloudSunIcon aria-hidden="true" />
      <span>{{ weather.city }} {{ weather.weather }} {{ weather.temperatureC }}°C</span>
    </div>
    <div v-if="onlineVisitors !== null" class="landing-meta__item">
      <UsersIcon aria-hidden="true" />
      <span>{{ onlineVisitors }} 人在线</span>
    </div>
    <div v-if="uptimeText" class="landing-meta__item">
      <ClockIcon aria-hidden="true" />
      <span>{{ uptimeText }}</span>
    </div>
  </section>
</template>

<style scoped>
.landing-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  color: var(--landing-muted);
  font-size: 0.875rem;
  line-height: 1.45;
  letter-spacing: -0.016em;
}

.landing-meta__item {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
}

.landing-meta__item span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.landing-meta__item svg {
  width: 0.9375rem;
  height: 0.9375rem;
  flex: none;
  stroke-width: 1.7;
}
</style>
