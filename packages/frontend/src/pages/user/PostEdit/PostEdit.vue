<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { kChip, kDialog, kDialogButton } from 'konsta/vue';
import { usePostEdit } from './hooks/usePostEdit';
import { useTagEditor } from './hooks/useTagEditor';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { ROUTE_NAMES } from '@/constants/permission';
import Input from '@/components/ui/input/index.vue';
import Button from '@/components/ui/button/index.vue';
import Card from '@/components/ui/card/index.vue';
import Select from '@/components/ui/select/index.vue';
import MarkdownEditor from '@/components/ui/markdown-editor/MarkdownEditor.vue';
import Loading from '@/components/ui/loading/index.vue';
import type { PostStatus } from '@/types/post';

/**
 * 路由实例
 */
const route = useRoute();

/**
 * 是否为编辑模式
 * 通过路由名称判断是否为编辑模式
 */
const isEditMode = computed(() => {
  return route.name === ROUTE_NAMES.USER_POST_EDIT;
});

/**
 * 文章 slug（从路由参数获取）
 * 仅在编辑模式下获取 slug
 */
const postSlug = computed(() => {
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
 * 使用文章编辑 Hook
 */
const {
  formData,
  postDetail,
  loadingPostDetail,
  postDetailError,
  saving,
  saveError,
  handleSave,
} = usePostEdit({
  isEditMode,
  postSlug,
});

/**
 * 使用标签编辑 Hook
 */
const {
  showAddTagDialog,
  newTagInput,
  handleAddTag,
  handleDeleteTag,
  handleOpenAddTagDialog,
  handleCloseAddTagDialog,
} = useTagEditor({
  getTags: () => formData.value.tags || [],
  setTags: (tags: string[]) => {
    formData.value.tags = tags;
  },
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
 * 文章状态选项
 */
const statusOptions: Array<{ value: PostStatus; label: string }> = [
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
  <div class="post-edit-page common-page-container">
    <!-- 加载文章详情状态 -->
    <div v-if="isEditMode && loadingPostDetail" class="text-center text-gray-600 py-12">
      <Loading />
    </div>

    <!-- 文章详情加载错误 -->
    <div v-else-if="isEditMode && postDetailError" class="text-center text-red-600 py-12">
      <p>加载失败: {{ postDetailError.message || '未知错误' }}</p>
    </div>

    <!-- 编辑表单 -->
    <div v-else class="post-edit-content">
      <div class="edit-layout">
        <!-- 左侧主要内容区 -->
        <div class="edit-main">
          <!-- 标题编辑 -->
          <div outline class="mb-4">
            <div class="mb-4">
              <h3 class="block text-lg font-medium text-gray-900 mb-2">
                Slug
              </h3>
              <Input
                v-model="formData.slug"
                type="text"
                placeholder="请输入文章 slug（只能包含小写字母、数字和连字符）"
                :validation-status="saveError ? 'error' : 'normal'"
                :validation-message="saveError || ''"
              />
              <p class="text-xs text-gray-500 mt-1">
                文章的 URL 友好标识符，只能包含小写字母、数字和连字符
              </p>
            </div>
            <div class="mb-4">
              <h3 class="block text-lg font-medium text-gray-900 mb-2">
                文章标题
              </h3>
              <Input
                v-model="formData.title"
                type="text"
                placeholder="请输入文章标题"
                :validation-status="saveError ? 'error' : 'normal'"
                :validation-message="saveError || ''"
              />
            </div>
            <div>
              <h3 class="block text-lg font-medium text-gray-900 mb-2">
                文章内容
              </h3>
              <MarkdownEditor
                v-model="formData.content"
                placeholder="请输入文章内容（支持 Markdown）"
                :validation-status="saveError ? 'error' : 'normal'"
                :validation-message="saveError || ''"
              />
            </div>
          </div>
        </div>

        <!-- 右侧编辑项 -->
        <div class="edit-sidebar">
          <!-- 文章状态 -->
          <Card outline>
            <h4 class="text-sm font-semibold text-gray-900 mb-4">文章状态</h4>
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">
                文章状态
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
                选择文章的发布状态
              </p>
            </div>
          </Card>

          <!-- 文章样式 -->
          <Card outline>
            <h4 class="text-sm font-semibold text-gray-900 mb-4">元数据</h4>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-900 mb-2">
                文章封面
              </label>
              <Input
                v-model="formData.cover"
                type="text"
                placeholder="请输入文章封面 URL"
                :validation-status="saveError ? 'error' : 'normal'"
              />
              <p class="text-xs text-gray-500 mt-1">
                输入文章封面的图片 URL 地址
              </p>
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-900 mb-2">
                文章摘要
              </label>
              <Input
                v-model="formData.summary"
                type="text"
                placeholder="请输入文章摘要"
                :validation-status="saveError ? 'error' : 'normal'"
              />
              <p class="text-xs text-gray-500 mt-1">
                文章的简短描述，用于列表展示和 SEO
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">
                文章标签
              </label>
              <!-- 标签展示区域 -->
              <div v-if="formData.tags && formData.tags.length > 0" class="flex flex-wrap gap-2 mb-2">
                <k-chip
                  v-for="(tag, index) in formData.tags"
                  :key="index"
                  delete-button
                  @delete="handleDeleteTag(index)"
                >
                  {{ tag }}
                </k-chip>
              </div>
              <!-- 新增标签按钮 -->
              <Button
                small
                rounded
                class="w-full"
                @click="handleOpenAddTagDialog"
              >
                添加标签
              </Button>
              <p class="text-xs text-gray-500 mt-1">
                为文章添加标签，方便分类和检索
              </p>
            </div>
          </Card>

          <!-- 新增标签对话框 -->
          <k-dialog
            :opened="showAddTagDialog"
            @backdrop-click="handleCloseAddTagDialog"
          >
            <template #title>添加标签</template>
            <div class="p-4">
              <Input
                v-model="newTagInput"
                type="text"
                placeholder="请输入标签名称"
                @keyup.enter="handleAddTag"
              />
            </div>
            <template #buttons>
              <k-dialog-button @click="handleCloseAddTagDialog">
                取消
              </k-dialog-button>
              <k-dialog-button strong @click="handleAddTag">
                确定
              </k-dialog-button>
            </template>
          </k-dialog>

          <!-- 文章统计信息（仅编辑模式显示） -->
          <Card outline>
            <template v-if="isEditMode && postDetail">
              <h4 class="text-sm font-semibold text-gray-900 mb-4">文章统计</h4>
              <div class="space-y-2 text-sm mb-4">
                <div>
                  <span class="text-gray-600">创建时间：</span>
                  <span class="text-gray-900">{{ formatDate(postDetail.createdAt) }}</span>
                </div>
                <div v-if="postDetail.updatedAt && postDetail.updatedAt !== postDetail.createdAt">
                  <span class="text-gray-600">更新时间：</span>
                  <span class="text-gray-900">{{ formatDate(postDetail.updatedAt) }}</span>
                </div>
                <div>
                  <span class="text-gray-600">浏览次数：</span>
                  <span class="text-gray-900">{{ postDetail.viewCount }} 次</span>
                </div>
              </div>
            </template>

            <!-- 保存按钮 -->
            <div class="space-y-4">
              <Button
                :disabled="saving || loadingPostDetail"
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
.post-edit-page {
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

.post-edit-content {
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
