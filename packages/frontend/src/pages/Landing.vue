<script setup lang="ts">
import MessageGroup from '@/components/ui/message-group/index.vue'
import { getDynamicConfig } from '@/api/config'
import { useRequest } from 'alova/client'
import { computed } from 'vue';

interface IPersonalInfo {
  messageGroups: string[][];
  avatar: string;
}

const {
  loading,
  data: personalInfo,
} = useRequest(getDynamicConfig<IPersonalInfo>('blog-profile-v1'), {
  immediate: true,
});

const displayMessages = computed(() => {
  return personalInfo.value?.messageGroups.map((group) => {
    return group.map((message) => {
      return {
        id: message,
        content: message,
      }
    })
  })
})

</script>

<template>
  <div v-if="!loading" class="landing-page">
    <!-- <div class="landing-background"></div> -->
    <div class="landing-scroll-content">
      <div class="h-[50vh] w-full"></div>
      <div class="mx-auto w-full flex flex-col gap-4 px-4 sm:px-6 sm:max-w-[640px] md:max-w-[720px] lg:px-8 lg:max-w-[800px]">
        <MessageGroup v-for="(group, index) in displayMessages" :key="index" :messages="group" :avatar="personalInfo?.avatar" />
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.landing-page {
  @apply w-full h-[calc(100vh-64px)] relative;
}

.landing-background {
  @apply absolute top-0 left-0 w-full h-full z-0 opacity-[0.05];
  background: url('@/assets/images/bg.png') no-repeat center center;
  background-size: cover;
}

.landing-scroll-content {
  @apply relative w-full h-full z-1 overflow-y-auto py-4;
}
</style>
