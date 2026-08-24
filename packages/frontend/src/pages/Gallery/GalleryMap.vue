<script setup lang="ts">
import { ref } from 'vue';
import { Map, MapMarker } from '@/components/ui/map';
const props = defineProps<{ latitude: number; longitude: number }>();
const failed = ref(false);
</script>
<template><div class="relative h-44 overflow-hidden rounded-xl bg-muted" aria-label="照片拍摄位置地图"><Map :center="[props.longitude, props.latitude]" :zoom="11" :options="{ attributionControl: false }" @error="failed = true"><MapMarker :coordinates="[props.longitude, props.latitude]" /></Map><div v-if="failed" class="absolute inset-0 grid place-items-center bg-muted px-4 text-center text-xs text-muted-foreground">地图暂时不可用<br />{{ latitude.toFixed(6) }}, {{ longitude.toFixed(6) }}</div></div></template>
