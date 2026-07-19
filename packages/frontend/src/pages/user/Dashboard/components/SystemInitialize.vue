<script setup lang="ts">
import { computed, ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * 系统初始化组件 Props
 */
interface ISystemInitializeProps {
  /**
   * 初始化加载状态
   */
  loading: boolean;
  /**
   * 初始化失败时的错误文案（内联展示）
   */
  errorMessage?: string | null;
}

/**
 * 系统初始化组件 Emits
 */
interface ISystemInitializeEmits {
  /**
   * 用户确认后触发初始化
   */
  (e: 'initialize'): void;
}

const props = defineProps<ISystemInitializeProps>();
const emit = defineEmits<ISystemInitializeEmits>();

/**
 * 确认对话框是否打开
 */
const confirmOpen = ref(false);

/**
 * 是否展示内联错误
 */
const hasError = computed(() => Boolean(props.errorMessage));

/**
 * 打开确认对话框
 */
function handleOpenConfirm(): void {
  if (props.loading) {
    return;
  }
  confirmOpen.value = true;
}

/**
 * 关闭确认对话框
 */
function handleCloseConfirm(): void {
  confirmOpen.value = false;
}

/**
 * 确认后触发初始化
 */
function handleConfirm(): void {
  confirmOpen.value = false;
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
            系统尚未初始化。初始化会写入默认站点配置，之后可在「系统设置」中修改。
          </p>

          <p
            v-if="hasError"
            class="text-sm text-destructive mb-4"
            role="alert"
          >
            {{ errorMessage }}
          </p>

          <Button
            class="w-full"
            :disabled="loading"
            @click="handleOpenConfirm"
          >
            {{ loading ? '初始化中...' : '初始化系统' }}
          </Button>
        </CardContent>
      </Card>
    </div>

    <Dialog v-model:open="confirmOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认初始化系统？</DialogTitle>
          <DialogDescription>
            将创建默认系统配置。若站点已有配置，此操作可能被拒绝。请确认你有管理员权限，并了解这是一次性引导步骤。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="handleCloseConfirm">
            取消
          </Button>
          <Button :disabled="loading" @click="handleConfirm">
            确认初始化
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
