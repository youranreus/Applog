<script setup lang="ts">
import { VMarker } from '@geoql/v-maplibre';
import type { LngLatLike } from 'maplibre-gl';
export interface MapMarkerProps { coordinates: LngLatLike; color?: string; scale?: number; }
const props = withDefaults(defineProps<MapMarkerProps>(), { color: '#0071e3', scale: 1 });
</script>
<template><VMarker :coordinates="props.coordinates" :color="props.color" :scale="props.scale" /></template>
