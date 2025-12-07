<template>
  <k-card class="my-0 mx-safe-0!" :v-bind="$attrs">
    <slot />
  </k-card>
</template>
<script setup lang="ts">
import { kCard } from 'konsta/vue'
</script>