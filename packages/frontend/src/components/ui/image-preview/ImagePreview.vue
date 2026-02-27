<script setup lang="ts">
import { watch, onUnmounted } from 'vue';

defineOptions({
  name: 'ImagePreview',
});

interface IProps {
  /** 是否显示预览层 */
  visible: boolean;
  /** 图片地址 */
  src: string;
  /** 图片注释（alt），显示在底部，仅文字无背景 */
  alt: string;
}

const props = defineProps<IProps>();

const emit = defineEmits<{
  close: [];
}>();

/**
 * 关闭预览（点击遮罩或 ESC）
 */
const onClose = (): void => {
  emit('close');
};

/**
 * 处理 ESC 键
 * @param e - 键盘事件
 */
const handleKeydown = (e: KeyboardEvent): void => {
  if (e.key === 'Escape') onClose();
};

// 监听 visible，打开时绑定 keydown，关闭时解绑
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      window.addEventListener('keydown', handleKeydown);
    } else {
      window.removeEventListener('keydown', handleKeydown);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

/** 淡入：进入前透明度 0 */
const onBeforeEnter = (el: Element): void => {
  (el as HTMLElement).style.opacity = '0';
};

/** 淡入：过渡到透明度 1 */
const onEnter = (el: Element, done: () => void): void => {
  const overlay = el as HTMLElement;
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    setTimeout(done, 200);
  });
};

/** 淡出 */
const onLeave = (el: Element, done: () => void): void => {
  (el as HTMLElement).style.opacity = '0';
  setTimeout(done, 200);
};
</script>

<template>
  <Teleport to="body">
    <Transition
      name="image-preview"
      @before-enter="onBeforeEnter"
      @enter="onEnter"
      @leave="onLeave"
    >
      <div
        v-if="visible"
        class="image-preview-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="图片预览"
        @click.self="onClose"
      >
        <div class="image-preview-content">
          <img
            v-if="src"
            :src="src"
            :alt="alt"
            class="image-preview-img"
            draggable="false"
            @click.stop
          />
          <p v-if="alt" class="image-preview-caption">{{ alt }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@reference 'tailwindcss';

.image-preview-overlay {
  @apply fixed inset-0 z-9999 flex flex-col items-center justify-center bg-black/50;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: opacity 0.2s ease-out;
}

.image-preview-content {
  @apply flex flex-col items-center justify-center max-w-[90vw] max-h-[85vh];
}

.image-preview-img {
  @apply block max-w-full max-h-[80vh] w-auto h-auto object-contain;
}

/* 说明文字仅文字无深色背景，与文章内 image-caption 风格一致 */
.image-preview-caption {
  @apply mt-2 w-full text-center text-xs text-white/80 max-w-[90vw];
}
</style>
