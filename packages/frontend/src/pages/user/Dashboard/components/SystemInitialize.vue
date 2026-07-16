<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * 系统初始化组件 Props
 */
interface ISystemInitializeProps {
  /**
   * 初始化加载状态
   */
  loading: boolean;
}

/**
 * 系统初始化组件 Emits
 */
interface ISystemInitializeEmits {
  /**
   * 点击初始化按钮时触发
   */
  (e: 'initialize'): void;
}

defineProps<ISystemInitializeProps>();
const emit = defineEmits<ISystemInitializeEmits>();

/**
 * 处理初始化按钮点击
 */
function handleClick(): void {
  emit('initialize');
}
</script>

<template>
  <div class="min-h-[400px] flex items-center justify-center">
    <div class="w-full max-w-md px-6 py-12">
      <Card>
        <CardContent>
          <h2 class="text-2xl font-bold mb-4">系统初始化</h2>

          <p class="text-sm text-muted-foreground mb-4">
            系统尚未初始化，请点击下方按钮进行初始化
          </p>

          <Button
            class="w-full"
            :disabled="loading"
            @click="handleClick"
          >
            {{ loading ? '初始化中...' : '初始化系统' }}
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
