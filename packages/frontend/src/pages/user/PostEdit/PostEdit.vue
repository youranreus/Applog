<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { usePostEdit } from './hooks/usePostEdit';
import { useTagEditor } from './hooks/useTagEditor';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { ROUTE_NAMES } from '@/constants/permission';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
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
  <div class="post-edit-page admin-page-container">
    <!-- 加载文章详情状态 -->
    <div v-if="isEditMode && loadingPostDetail" class="text-center text-gray-600 py-12 min-h-[400px]">
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
          <div class="edit-pane-scroll">
            <FieldGroup class="mb-4 gap-4">
              <Field>
                <FieldLabel class="text-lg font-medium text-gray-900">
                  Slug
                </FieldLabel>
                <Input
                  v-model="formData.slug"
                  type="text"
                  placeholder="请输入文章 slug（只能包含小写字母、数字和连字符）"
                  :aria-invalid="!!saveError"
                />
                <FieldDescription>
                  文章的 URL 友好标识符，只能包含小写字母、数字和连字符
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel class="text-lg font-medium text-gray-900">
                  文章标题
                </FieldLabel>
                <Input
                  v-model="formData.title"
                  type="text"
                  placeholder="请输入文章标题"
                  :aria-invalid="!!saveError"
                />
              </Field>

              <Field>
                <FieldLabel class="text-lg font-medium text-gray-900">
                  文章内容
                </FieldLabel>
                <MarkdownEditor
                  v-model="formData.content"
                  placeholder="请输入文章内容（支持 Markdown）"
                  :validation-status="saveError ? 'error' : 'normal'"
                  :validation-message="saveError || ''"
                />
              </Field>
            </FieldGroup>
          </div>
        </div>

        <!-- 右侧编辑项 -->
        <div class="edit-sidebar">
          <div class="edit-pane-scroll edit-sidebar-scroll">
          <!-- 文章状态 -->
          <Card>
            <CardContent>
              <h4 class="text-sm font-semibold text-gray-900 mb-4">文章状态</h4>
              <Field>
                <FieldLabel>文章状态</FieldLabel>
                <Select v-model="formData.status">
                  <SelectTrigger class="w-full" :aria-invalid="!!saveError">
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in statusOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  选择文章的发布状态
                </FieldDescription>
              </Field>
            </CardContent>
          </Card>

          <!-- 元数据 -->
          <Card>
            <CardContent>
              <h4 class="text-sm font-semibold text-gray-900 mb-4">元数据</h4>
              <FieldGroup class="gap-4">
                <Field>
                  <FieldLabel>文章封面</FieldLabel>
                  <Input
                    v-model="formData.cover"
                    type="text"
                    placeholder="请输入文章封面 URL"
                    :aria-invalid="!!saveError"
                  />
                  <FieldDescription>
                    输入文章封面的图片 URL 地址
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel>文章摘要</FieldLabel>
                  <Input
                    v-model="formData.summary"
                    type="text"
                    placeholder="请输入文章摘要"
                    :aria-invalid="!!saveError"
                  />
                  <FieldDescription>
                    文章的简短描述，用于列表展示和 SEO
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel>文章标签</FieldLabel>
                  <div v-if="formData.tags && formData.tags.length > 0" class="flex flex-wrap gap-2 mb-2">
                    <Badge
                      v-for="(tag, index) in formData.tags"
                      :key="index"
                      variant="secondary"
                      class="cursor-pointer gap-1"
                      @click="handleDeleteTag(index)"
                    >
                      {{ tag }}
                      <span aria-hidden="true">×</span>
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    class="w-full"
                    @click="handleOpenAddTagDialog"
                  >
                    添加标签
                  </Button>
                  <FieldDescription>
                    为文章添加标签，方便分类和检索
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <!-- 新增标签对话框 -->
          <Dialog v-model:open="showAddTagDialog">
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加标签</DialogTitle>
              </DialogHeader>
              <Input
                v-model="newTagInput"
                type="text"
                placeholder="请输入标签名称"
                @keyup.enter="handleAddTag"
              />
              <DialogFooter>
                <Button variant="outline" @click="handleCloseAddTagDialog">
                  取消
                </Button>
                <Button @click="handleAddTag">
                  确定
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <!-- 文章统计信息（仅编辑模式显示） -->
          <Card>
            <CardContent>
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

              <FieldError v-if="saveError" :errors="[saveError]" class="mb-4" />

              <!-- 保存按钮 -->
              <div class="space-y-4">
                <Button
                  :disabled="saving || loadingPostDetail"
                  class="w-full"
                  @click="onSaveClick"
                >
                  {{ saving ? '保存中...' : '保存' }}
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
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
  min-width: 0;
  min-height: 0;
  width: 100%; /* 手机竖屏下占满宽度 */
  overflow: hidden; /* 外层只负责占位对齐，滚动放在内层 */
}

.edit-sidebar {
  width: 100%; /* 手机竖屏下占满宽度 */
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/**
 * 内层滚动容器：为外扩 focus ring（box-shadow）预留 gutter。
 * padding 加在这里而不是 .edit-main/.edit-sidebar，避免破坏左右列外沿对齐。
 */
.edit-pane-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px;
}

.edit-sidebar-scroll {
  display: flex;
  flex-direction: column;
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
