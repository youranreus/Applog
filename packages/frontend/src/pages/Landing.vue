<script setup lang="ts">
import MessageGroup from '@/components/ui/message-group/index.vue'

const messages = [
  [
    'Hey，这里是季悠然，2002年生人，在深圳长大',
    '现在就职于腾讯，曾经主攻前端开发，主要技术栈是 Vue。现在已经转型为 AI 奴役者，正在学习如何更加优雅地压榨 AI',
  ],
  [
    '平时喜欢跑步、听歌、打游戏，是个二次元、电车迷。',
    '听歌主要是J-POP、粤语、华语流行',
    '正在练习中长跑，月跑量90km左右，诚信五分半配速，这里是我的[跑步合集](https://www.youtube.com/watch?v=dQw4w9WgXcQ)',
    '喜欢日本电车，尤其是首都圈通勤电车，对新干线等高速铁路无感。正在猛猛购买 N 比例电车模型，可以在[这里](https://www.youtube.com/watch?v=dQw4w9WgXcQ)看到我的车车',
  ],
]

const AVATAR_URL = 'https://cdn.exia.xyz/img/avatar/suica.jpg'

const displayMessages = messages.map((group) => {
  return group.map((message) => {
    return {
      id: message,
      content: message,
    }
  })
})

</script>

<template>
  <div class="landing-page">
    <div class="landing-background"></div>
    <div class="landing-scroll-content">
      <div class="flex items-center justify-center h-[70vh]">
        <img class="w-[150px] h-[150px] rounded-full" src="@/assets/images/avatar.jpg" alt="avatar" />
      </div>
      <div class="mx-auto w-full flex flex-col gap-4 px-4 sm:px-6 sm:max-w-[640px] md:max-w-[720px] lg:px-8 lg:max-w-[800px]">
        <MessageGroup v-for="(group, index) in displayMessages" :key="index" :messages="group" :avatar="AVATAR_URL" />
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
