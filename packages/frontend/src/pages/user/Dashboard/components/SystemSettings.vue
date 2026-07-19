<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { useRequest } from 'alova/client';
import { useSystemStore } from '@/stores/useSystemStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { setConfig } from '@/api/system-config';
import { getSystemConfigKey, SYSTEM_CONFIG_KEYS, type ISystemBaseConfig } from '@applog/common';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * 使用系统配置 Store 获取配置数据
 */
const systemStore = useSystemStore();

/**
 * 布局 Store：通知反馈
 */
const layoutStore = useLayoutStore();

/**
 * 表单数据（响应式）
 */
const formData = ref<ISystemBaseConfig>({
  title: '',
  description: '',
  allowUserLogin: true,
  allowComment: true,
});

/**
 * 权限变更确认对话框
 */
const permissionConfirmOpen = ref(false);

/**
 * 构建保存配置的请求参数
 * @returns 请求参数对象
 */
function buildSaveConfigParams() {
  const configKey = getSystemConfigKey(SYSTEM_CONFIG_KEYS.BASE_CONFIG);
  const configValue = JSON.stringify(formData.value);

  return {
    configKey,
    configValue,
    description: '系统基础配置',
    extra: {
      type: 'ISystemBaseConfig',
    },
  };
}

/**
 * 使用 useRequest 处理保存配置请求
 */
const {
  loading: saving,
  error: saveRequestError,
  send: saveConfigRequest,
} = useRequest(
  () => setConfig(buildSaveConfigParams()),
  {
    immediate: false,
  },
);

/**
 * 保存错误信息（从请求错误中提取）
 */
const saveError = computed<string | null>(() => {
  if (!saveRequestError.value) {
    return null;
  }

  if (saveRequestError.value instanceof Error) {
    return saveRequestError.value.message;
  }

  return '保存配置失败，请稍后重试';
});

/**
 * 是否将关闭用户登录（相对已保存配置）
 */
const willDisableUserLogin = computed(() => {
  const saved = systemStore.config;
  if (!saved) {
    return formData.value.allowUserLogin === false;
  }
  return saved.allowUserLogin === true && formData.value.allowUserLogin === false;
});

/**
 * 是否将关闭评论
 */
const willDisableComment = computed(() => {
  const saved = systemStore.config;
  if (!saved) {
    return formData.value.allowComment === false;
  }
  return saved.allowComment === true && formData.value.allowComment === false;
});

/**
 * 保存前是否需要权限确认
 */
const needsPermissionConfirm = computed(() => {
  return willDisableUserLogin.value || willDisableComment.value;
});

/**
 * 确认对话框说明文案
 */
const permissionConfirmDescription = computed(() => {
  const parts: string[] = [];
  if (willDisableUserLogin.value) {
    parts.push('关闭「允许用户登录」后，非管理员访客将无法登录。');
  }
  if (willDisableComment.value) {
    parts.push('关闭「允许评论」后，公开文章将无法发表新评论。');
  }
  parts.push('确定要保存这些更改吗？');
  return parts.join(' ');
});

/**
 * 从 store 初始化表单数据
 */
function initializeFormData(): void {
  const config = systemStore.config;

  if (config) {
    formData.value = {
      title: config.title || '',
      description: config.description || '',
      allowUserLogin: config.allowUserLogin ?? true,
      allowComment: config.allowComment ?? true,
    };
  } else {
    formData.value = {
      title: '',
      description: '',
      allowUserLogin: true,
      allowComment: true,
    };
  }
}

watch(
  () => systemStore.config,
  () => {
    if (!systemStore.loading) {
      initializeFormData();
    }
  },
  { immediate: false },
);

onMounted(() => {
  if (!systemStore.loading && systemStore.config) {
    initializeFormData();
  }
});

/**
 * 从未知错误中提取可读消息
 * @param err - 捕获到的错误
 * @returns 面向用户的错误文案
 */
function getSaveErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (saveError.value) {
    return saveError.value;
  }
  return '保存配置失败，请稍后重试';
}

/**
 * 执行实际保存请求并反馈结果
 */
async function persistConfig(): Promise<void> {
  if (saving.value) {
    return;
  }

  try {
    await saveConfigRequest();
    await systemStore.refreshConfig();
    layoutStore.notify({
      title: '保存成功',
      content: '系统配置已更新',
      type: 'success',
    });
  } catch (error) {
    console.error('保存系统配置失败:', error);
    layoutStore.notify({
      title: '保存失败',
      content: getSaveErrorMessage(error),
      type: 'error',
    });
  }
}

/**
 * 处理保存：危险权限变更时先确认
 */
async function handleSave(): Promise<void> {
  if (saving.value || systemStore.loading) {
    return;
  }

  if (needsPermissionConfirm.value) {
    permissionConfirmOpen.value = true;
    return;
  }

  await persistConfig();
}

/**
 * 取消权限确认
 */
function handleCancelPermissionConfirm(): void {
  permissionConfirmOpen.value = false;
}

/**
 * 确认后保存
 */
async function handleConfirmPermissionSave(): Promise<void> {
  permissionConfirmOpen.value = false;
  await persistConfig();
}
</script>

<template>
  <div class="system-settings">
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-foreground mb-2">系统设置</h2>
      <p class="text-muted-foreground text-sm">
        管理站点基础信息与访问权限
      </p>
    </div>

    <div v-if="systemStore.error" class="text-center text-destructive py-12">
      <p class="mb-4">加载失败，请稍后重试</p>
      <Button variant="outline" @click="systemStore.refreshConfig()">
        重试
      </Button>
    </div>

    <div v-else class="space-y-8">
      <FieldGroup class="gap-4">
        <h3 class="text-sm font-semibold text-foreground">站点信息</h3>
        <Field>
          <FieldLabel>系统标题</FieldLabel>
          <Input
            v-model="formData.title"
            type="text"
            placeholder="请输入系统标题"
          />
        </Field>

        <Field>
          <FieldLabel>系统描述</FieldLabel>
          <Input
            v-model="formData.description"
            type="text"
            placeholder="请输入系统描述"
          />
        </Field>
      </FieldGroup>

      <FieldGroup class="gap-4">
        <h3 class="text-sm font-semibold text-foreground">访问与互动</h3>
        <Field orientation="horizontal">
          <div class="flex-1">
            <FieldLabel>允许用户登录</FieldLabel>
            <FieldDescription>
              关闭后，访客将无法登录（请确认你仍能管理站点）
            </FieldDescription>
          </div>
          <Switch v-model:checked="formData.allowUserLogin" />
        </Field>

        <Field orientation="horizontal">
          <div class="flex-1">
            <FieldLabel>允许评论</FieldLabel>
            <FieldDescription>
              关闭后，公开内容将无法发表新评论
            </FieldDescription>
          </div>
          <Switch v-model:checked="formData.allowComment" />
        </Field>
      </FieldGroup>

      <FieldError v-if="saveError" :errors="[saveError]" />

      <div class="flex justify-end">
        <Button
          :disabled="saving || systemStore.loading"
          @click="handleSave"
        >
          {{ saving ? '保存中...' : '保存' }}
        </Button>
      </div>
    </div>

    <Dialog v-model:open="permissionConfirmOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认更改访问权限？</DialogTitle>
          <DialogDescription>
            {{ permissionConfirmDescription }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="handleCancelPermissionConfirm">
            取消
          </Button>
          <Button :disabled="saving" @click="handleConfirmPermissionSave">
            确认保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.system-settings {
  width: 100%;
}
</style>
