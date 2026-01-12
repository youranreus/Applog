<script setup lang="ts">
import { ref } from 'vue';
import MarkdownRenderer from '@/components/ui/markdown-renderer/MarkdownRenderer.vue';

interface Props {
  /**
   * 折叠面板标题
   */
  title?: string;
  /**
   * 折叠面板内容（支持 markdown）
   */
  content: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '点击展开',
});

/**
 * 折叠/展开状态
 */
const isExpanded = ref(false);

/**
 * 切换折叠/展开状态
 */
function toggleExpand(): void {
  isExpanded.value = !isExpanded.value;
}
</script>

<template>
  <div class="collapse-container my-4 rounded-2xl bg-[#F5F5F7] overflow-hidden">
    <!-- 标题栏（可点击） -->
    <div
      class="collapse-header flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors"
      @click="toggleExpand"
    >
      <div
        class="text-gray-500 text-lg transition-transform duration-300 flex items-center justify-center"
        :class="{ 'icon-expanded': isExpanded }"
      >
        <ion-icon
          name="chevron-forward-outline"
        />
      </div>
      
      <span class="font-medium text-gray-800">{{ props.title }}</span>
    </div>
    <!-- 内容区域（条件渲染 + 过渡动画） -->
    <Transition name="collapse">
      <div v-if="isExpanded" class="collapse-content px-4 py-3">
        <MarkdownRenderer :content="props.content" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
@reference 'tailwindcss';

/* 确保 ion-icon 正确显示 */
ion-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
}

/* 折叠动画 */
.collapse-enter-active {
  transition: max-height 0.3s ease, opacity 0.3s ease 0.05s, padding-top 0.3s ease, padding-bottom 0.3s ease;
  overflow: hidden;
}

.collapse-leave-active {
  transition: max-height 0.3s ease, opacity 0.2s ease, padding-top 0.25s ease 0.1s, padding-bottom 0.25s ease 0.1s;
  overflow: hidden;
}

.collapse-enter-from {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.collapse-enter-to {
  max-height: 2000px;
  opacity: 1;
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
}

.collapse-leave-from {
  max-height: 2000px;
  opacity: 1;
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
}

.collapse-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.icon-expanded {
  transform: rotate(90deg);
}
</style>