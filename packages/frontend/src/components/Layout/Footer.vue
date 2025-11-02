<script setup lang="ts">
import { computed } from 'vue'

const currentYear = computed(() => new Date().getFullYear())
</script>

<template>
  <footer class="bg-gray-50 border-t border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-center h-16">
        <p class="text-sm text-gray-600">
          © {{ currentYear }} AppLog. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
</template>

