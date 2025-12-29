<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { kToggle } from 'konsta/vue';
import { usePageEdit } from './hooks/usePageEdit';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { ROUTE_NAMES } from '@/constants/permission';
import Input from '@/components/ui/input/index.vue';
import Button from '@/components/ui/button/index.vue';
import Card from '@/components/ui/card/index.vue';
import Select from '@/components/ui/select/index.vue';
import MarkdownEditor from '@/components/ui/markdown-editor/MarkdownEditor.vue';
import Loading from '@/components/ui/loading/index.vue';
import type { PageStatus } from '@/types/page';

/**
 * 路由实例
 */
const route = useRoute();

/**
 * 是否为编辑模式
 * 通过路由名称判断是否为编辑模式
 */
const isEditMode = computed(() => {
  return route.name === ROUTE_NAMES.USER_PAGE_EDIT;
});

/**
 * 页面 Slug（从路由参数获取）
 * 仅在编辑模式下获取 slug
 */
const pageSlug = computed(() => {
  if (isEditMode.value) {
    return String(route.params.slug || '');
  }
  return '';
});

/**
 * 布局 Store（用于显示通知）
 */
const layoutStore = useLayoutStore();

/**
 * 使用页面编辑 Hook
 */
const {
  formData,
  pageDetail,
  loadingPageDetail,
  pageDetailError,
  saving,
  saveError,
  handleSave,
} = usePageEdit({
  isEditMode,
  pageSlug,
});

/**
 * 处理保存按钮点击
 */
async function onSaveClick(): Promise<void> {
  try {
    await handleSave(
      (message) => {
        layoutStore.notify({
          title: '成功',
          content: message,
          type: 'success',
        });
      },
      (message) => {
        layoutStore.notify({
          title: '错误',
          content: message,
          type: 'error',
        });
      },
    );
  } catch (error) {
    // 错误已由 onError 回调处理
    console.error('保存失败:', error);
  }
}

/**
 * 页面状态选项
 */
const statusOptions: Array<{ value: PageStatus; label: string }> = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
];

/**
 * 格式化日期
 * @param date - 日期字符串或 Date 对象
 * @returns 格式化后的日期字符串
 */
const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
</script>

<template>
  <div class="page-edit-page common-page-container">
    <!-- 加载页面详情状态 -->
    <div v-if="isEditMode && loadingPageDetail" class="text-center text-gray-600 py-12">
      <Loading />
    </div>

    <!-- 页面详情加载错误 -->
    <div v-else-if="isEditMode && pageDetailError" class="text-center text-red-600 py-12">
      <p>加载失败: {{ pageDetailError.message || '未知错误' }}</p>
    </div>

    <!-- 编辑表单 -->
    <div v-else class="page-edit-content">
      <div class="edit-layout">
        <!-- 左侧主要内容区 -->
        <div class="edit-main">
          <!-- 标题编辑 -->
          <div outline class="mb-4">
            <div class="mb-4">
              <h3 class="block text-lg font-medium text-gray-900 mb-2">
                页面标题
              </h3>
              <Input
                v-model="formData.title"
                type="text"
                placeholder="请输入页面标题"
                :validation-status="saveError ? 'error' : 'normal'"
                :validation-message="saveError || ''"
              />
            </div>
            <div class="mb-4">
              <h3 class="block text-lg font-medium text-gray-900 mb-2">
                页面摘要
              </h3>
              <Input
                v-model="formData.summary"
                type="text"
                placeholder="请输入页面摘要（可选）"
                :validation-status="saveError ? 'error' : 'normal'"
              />
              <p class="text-xs text-gray-500 mt-1">
                页面的简短描述，用于列表展示和 SEO
              </p>
            </div>
            <div>
              <h3 class="block text-lg font-medium text-gray-900 mb-2">
                页面内容
              </h3>
              <MarkdownEditor
                v-model="formData.content"
                placeholder="请输入页面内容（支持 Markdown）"
                :validation-status="saveError ? 'error' : 'normal'"
                :validation-message="saveError || ''"
              />
            </div>
          </div>
        </div>

        <!-- 右侧编辑项 -->
        <div class="edit-sidebar">
          <!-- 页面标识 -->
          <Card outline>
            <h4 class="text-sm font-semibold text-gray-900 mb-4">页面标识</h4>
            
            <!-- Slug 输入 -->
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">
                页面 Slug
              </label>
              <Input
                v-model="formData.slug"
                type="text"
                placeholder="请输入页面 slug（用于 URL）"
                :validation-status="saveError ? 'error' : 'normal'"
              />
              <p class="text-xs text-gray-500 mt-1">
                页面的唯一标识，用于生成 URL
              </p>
            </div>
          </Card>

          <!-- 页面状态 -->
          <Card outline>
            <h4 class="text-sm font-semibold text-gray-900 mb-4">页面状态</h4>
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">
                页面状态
              </label>
              <Select
                v-model="formData.status"
                :validation-status="saveError ? 'error' : 'normal'"
              >
                <option
                  v-for="option in statusOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </Select>
              <p class="text-xs text-gray-500 mt-1">
                选择页面的发布状态
              </p>
            </div>
          </Card>

          <!-- 显示设置 -->
          <Card outline>
            <h4 class="text-sm font-semibold text-gray-900 mb-4">显示设置</h4>
            
            <!-- 显示于导航栏 -->
            <div class="mb-4">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <label class="block text-sm font-medium text-gray-900 mb-1">
                    显示于导航栏
                  </label>
                  <p class="text-sm text-gray-500">
                    控制页面是否在导航栏中显示
                  </p>
                </div>
                <div class="ml-4">
                  <k-toggle
                    :checked="formData.showInNav"
                    @change="formData.showInNav = !formData.showInNav"
                  />
                </div>
              </div>
            </div>

            <!-- 显示于底部 -->
            <div>
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <label class="block text-sm font-medium text-gray-900 mb-1">
                    显示于底部
                  </label>
                  <p class="text-sm text-gray-500">
                    控制页面是否在 Footer 中显示
                  </p>
                </div>
                <div class="ml-4">
                  <k-toggle
                    :checked="formData.showInFooter"
                    @change="formData.showInFooter = !formData.showInFooter"
                  />
                </div>
              </div>
            </div>
          </Card>

          <!-- 页面统计信息（仅编辑模式显示） -->
          <Card outline>
            <template v-if="isEditMode && pageDetail">
              <h4 class="text-sm font-semibold text-gray-900 mb-4">页面统计</h4>
              <div class="space-y-2 text-sm mb-4">
                <div>
                  <span class="text-gray-600">创建时间：</span>
                  <span class="text-gray-900">{{ formatDate(pageDetail.createdAt) }}</span>
                </div>
                <div v-if="pageDetail.updatedAt && pageDetail.updatedAt !== pageDetail.createdAt">
                  <span class="text-gray-600">更新时间：</span>
                  <span class="text-gray-900">{{ formatDate(pageDetail.updatedAt) }}</span>
                </div>
                <div>
                  <span class="text-gray-600">浏览次数：</span>
                  <span class="text-gray-900">{{ pageDetail.viewCount }} 次</span>
                </div>
              </div>
            </template>

            <!-- 保存按钮 -->
            <div class="space-y-4">
              <Button
                :disabled="saving || loadingPageDetail"
                rounded
                class="w-full"
                @click="onSaveClick"
              >
                {{ saving ? '保存中...' : '保存' }}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-edit-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-header {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
  flex-shrink: 0;
}

.page-edit-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.edit-layout {
  display: flex;
  flex-direction: column; /* 默认上下布局（手机竖屏） */
  gap: 1.5rem;
  height: 100%;
  overflow: hidden;
}

.edit-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-width: 0;
  width: 100%; /* 手机竖屏下占满宽度 */
}

.edit-sidebar {
  width: 100%; /* 手机竖屏下占满宽度 */
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  gap: 1.5rem;
}

/* 平板及以上屏幕（768px+）使用左右布局 */
@media (min-width: 768px) {
  .edit-layout {
    flex-direction: row; /* 改为左右布局 */
  }

  .edit-main {
    width: auto; /* 恢复自动宽度 */
  }

  .edit-sidebar {
    width: 320px; /* 固定宽度 */
  }
}

</style>
