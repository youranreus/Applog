<template>
  <k-button class="px-4 py-2 font-normal w-fit" :v-bind="$attrs">
    <slot />
  </k-button>
</template>
<script setup lang="ts">
import { kButton } from 'konsta/vue'
</script>