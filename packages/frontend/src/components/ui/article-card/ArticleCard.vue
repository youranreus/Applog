<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useRequest } from 'alova/client';
import { getPostBasicInfo } from '@/api/post/getPostBasicInfo';
import { ROUTE_NAMES } from '@/constants/permission';

interface Props {
  /**
   * 文章 slug（从 content prop 中获取）
   */
  content: string;
}

const props = defineProps<Props>();

const router = useRouter();

/**
 * 使用 alova 的 useRequest 获取文章基础信息
 * 接口路径: GET /post/:slug/basic
 * 响应拦截器会自动提取 data 字段，返回 IPostBasicInfo 类型
 *
 * 逻辑说明：
 * 1. 使用函数形式传入请求方法，alova 会自动追踪 props.content 的变化
 * 2. 当 props.content 变化时，会自动重新请求数据
 * 3. 立即请求数据
 */
const {
  loading,
  data: postInfo,
  error,
} = useRequest(
  () => getPostBasicInfo(props.content),
  {
    immediate: true, // 立即请求
  },
);

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param date - 日期字符串
 * @returns 格式化后的日期字符串
 */
function formatDate(date: string): string {
  const dateObj = new Date(date);

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * 格式化后的发布日期
 */
const formattedDate = computed(() => {
  if (!postInfo.value?.createdAt) {
    return '';
  }
  return formatDate(postInfo.value.createdAt);
});

/**
 * 点击卡片跳转到文章详情页
 */
function handleClick() {
  if (postInfo.value) {
    router.push({
      name: ROUTE_NAMES.POST_DETAIL,
      params: { slug: postInfo.value.slug },
    });
  }
}
</script>

<template>
  <div
    class="flex justify-center items-center w-full py-6"
  >
    <!-- 加载状态 -->
    <div v-if="loading" class="text-center text-gray-500 py-2">
      <p class="text-sm">加载中...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="text-center text-red-500 py-2">
      <p class="text-sm">加载失败，请稍后重试</p>
    </div>

    <!-- 成功状态 -->
    <div v-else-if="postInfo" class="flex flex-col w-[320px] p-4 rounded-2xl bg-[#EFEFEF] gap-y-2 cursor-pointer" @click="handleClick">
      <div class="article-card-title text-base font-bold text-[#0071e3]">
        {{ postInfo.title }}
      </div>
      <div class="flex justify-between items-center text-sm text-gray-500">
        <span class="article-card-date">
          {{ formattedDate }}
        </span>
        <span class="article-card-view-count">
          {{ postInfo.slug }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference 'tailwindcss';
</style>
