<script setup lang="ts">
import { kCard } from 'konsta/vue';
import { useRequest } from 'alova/client';
import { getUserOverview } from '@/api/user';
/**
 * 使用 alova 的 useRequest 获取用户创作概览信息
 * 接口路径: GET /user/overview
 * 响应拦截器会自动提取 data 字段，返回 IUserOverviewDto 类型
 */
const {
  loading,
  data: overviewData,
  error,
} = useRequest(getUserOverview, {
  immediate: true, // 立即请求
});
</script>

<template>
  <div class="personal-stats">
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">个人统计</h2>
      <p class="text-gray-600 text-sm">
        查看你的创作数据统计
      </p>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="text-center text-gray-600 py-12">
      <p>加载中...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="text-center text-red-600 py-12">
      <p>加载失败，请稍后重试</p>
    </div>

    <!-- 数据展示 -->
    <div v-else-if="overviewData" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- 文章数量 -->
      <k-card class="mx-safe-0! my-safe-0!" outline>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 mb-1">文章数量</p>
            <p class="text-3xl font-bold text-gray-900">{{ overviewData.postCount }}</p>
          </div>
          <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <ion-icon name="book-outline" class="text-2xl text-blue-600"></ion-icon>
          </div>
        </div>
      </k-card>

      <!-- 页面数量 -->
      <k-card class="mx-safe-0! my-safe-0!" outline>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 mb-1">页面数量</p>
            <p class="text-3xl font-bold text-gray-900">{{ overviewData.pageCount }}</p>
          </div>
          <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <ion-icon name="document-text-outline" class="text-2xl text-green-600"></ion-icon>
          </div>
        </div>
      </k-card>

      <!-- 评论数量 -->
      <k-card class="mx-safe-0! my-safe-0!" outline>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 mb-1">发表评论</p>
            <p class="text-3xl font-bold text-gray-900">{{ overviewData.commentCount }}</p>
          </div>
          <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
            <ion-icon name="chatbox-ellipses-outline" class="text-2xl text-purple-600"></ion-icon>
          </div>
        </div>
      </k-card>

      <!-- 收到评论数量 -->
      <k-card class="mx-safe-0! my-safe-0!" outline>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 mb-1">收到评论</p>
            <p class="text-3xl font-bold text-gray-900">{{ overviewData.receivedCommentCount }}</p>
          </div>
          <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
            <ion-icon name="chatbubbles-outline" class="text-2xl text-orange-600"></ion-icon>
          </div>
        </div>
      </k-card>
    </div>

    <!-- 无数据 -->
    <div v-else class="text-center text-gray-600 py-12">
      <p>暂无统计数据</p>
    </div>
  </div>
</template>

<style scoped>
.personal-stats {
  width: 100%;
}

/* 确保 ion-icon 正确显示 */
ion-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
}
</style>

