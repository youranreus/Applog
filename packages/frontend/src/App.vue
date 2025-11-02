<script setup lang="ts">
import Header from '@/components/Layout/Header.vue'
import Footer from '@/components/Layout/Footer.vue'
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <Header />
    <main class="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <router-view />
    </main>
    <Footer />
  </div>
</template>
