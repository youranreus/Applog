<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onErrorCaptured,
  type StyleValue,
  useId,
} from 'vue';
import { VMap } from '@geoql/v-maplibre';
import type { Map as MaplibreMap, MapOptions, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapProps {
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;
  colorMode?: 'light' | 'dark';
  styles?: { light?: string | StyleSpecification; dark?: string | StyleSpecification };
  options?: Partial<MapOptions>;
  class?: string;
  style?: StyleValue;
}

const props = withDefaults(defineProps<MapProps>(), {
  center: () => [0, 0], zoom: 2, bearing: 0, pitch: 0, colorMode: 'light',
});
const emit = defineEmits<{ load: [map: MaplibreMap]; error: [error: unknown] }>();
const containerId = `mapcn-${useId().replace(/:/g, '')}`;
let mapInstance: MaplibreMap | null = null;
const defaults = { light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' };
const mapStyle = computed(() => props.colorMode === 'dark' ? (props.styles?.dark ?? defaults.dark) : (props.styles?.light ?? defaults.light));
const mapOptions = computed<MapOptions>(() => ({ style: mapStyle.value, center: props.center, zoom: props.zoom,
  bearing: props.bearing, pitch: props.pitch, ...props.options, container: containerId }) as MapOptions);
function handleLoaded(map: MaplibreMap): void {
  mapInstance = map;
  emit('load', map);
}
function handleError(error: unknown): void {
  if (
    error &&
    typeof error === 'object' &&
    'target' in error &&
    error.target instanceof Object &&
    'remove' in error.target
  )
    mapInstance = error.target as MaplibreMap;
  emit('error', error);
}
onErrorCaptured((error) => {
  emit('error', error);
  return false;
});
onBeforeUnmount(() => {
  mapInstance?.remove();
  mapInstance = null;
});
</script>

<template>
  <VMap :options="mapOptions" :class="['h-full w-full', props.class]" :style="props.style" @loaded="handleLoaded" @error="handleError"><slot /></VMap>
</template>
