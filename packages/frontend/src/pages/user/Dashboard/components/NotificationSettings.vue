<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue';
import { useRequest } from 'alova/client';
import {
  NOTIFICATION_MAIL_TOKEN_MASK,
  type INotificationConfig,
} from '@applog/common';
import {
  getNotificationConfig,
  setNotificationConfig,
} from '@/api/notification';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';

const layoutStore = useLayoutStore();
const form = reactive<INotificationConfig>({ mailToken: '', enabled: false });
const tokenDraft = shallowRef('');

const {
  data,
  loading,
  error: loadError,
  send: reload,
} = useRequest(getNotificationConfig, { immediate: true });

function applyConfig(config: INotificationConfig): void {
  form.mailToken = config.mailToken || '';
  form.enabled = config.enabled === true;
  tokenDraft.value = '';
}

watch(data, (config) => config && applyConfig(config), { immediate: true });

const tokenPlaceholder = computed(() =>
  form.mailToken === NOTIFICATION_MAIL_TOKEN_MASK
    ? '已保存（留空不修改）'
    : '粘贴 H mail token',
);

const {
  loading: saving,
  error: saveRequestError,
  send: save,
} = useRequest(
  () =>
    setNotificationConfig({
      enabled: form.enabled,
      mailToken: tokenDraft.value,
    }),
  { immediate: false },
);

const saveError = computed(() => {
  if (!saveRequestError.value) return null;
  return saveRequestError.value instanceof Error
    ? saveRequestError.value.message
    : '保存评论邮件通知配置失败，请稍后重试';
});

async function handleSave(): Promise<void> {
  if (saving.value || loading.value) return;
  try {
    applyConfig(await save());
    layoutStore.notify({
      title: '保存成功',
      content: '评论邮件通知配置已更新',
      type: 'success',
    });
  } catch (error) {
    layoutStore.notify({
      title: '保存失败',
      content:
        error instanceof Error ? error.message : '请检查 mail token 后重试',
      type: 'error',
    });
  }
}
</script>

<template>
  <FieldGroup class="gap-4 border-t border-border pt-8">
    <div>
      <h3 class="text-sm font-semibold text-foreground">评论邮件通知</h3>
      <p class="mt-1 text-xs text-muted-foreground">
        通过 H 托管模板通知评论者审核结果，并提醒管理员有新评论。
      </p>
    </div>

    <div v-if="loadError" class="text-sm text-destructive">
      加载评论邮件配置失败，
      <button type="button" class="text-link-blue underline" @click="reload">
        重试
      </button>
    </div>

    <template v-else>
      <Field orientation="horizontal">
        <div class="flex-1">
          <FieldLabel>启用评论邮件通知</FieldLabel>
          <FieldDescription>
            启用前需在 H 发布两份模板并保存有效 mail token
          </FieldDescription>
        </div>
        <Switch v-model="form.enabled" />
      </Field>

      <Field>
        <FieldLabel>Mail token</FieldLabel>
        <Input
          v-model="tokenDraft"
          type="password"
          autocomplete="new-password"
          :placeholder="tokenPlaceholder"
          :disabled="loading"
        />
        <FieldDescription>
          token 只保存在服务端并脱敏读回；留空表示保留现有值
        </FieldDescription>
      </Field>

      <FieldError v-if="saveError" :errors="[saveError]" />

      <div class="flex justify-end">
        <Button :disabled="saving || loading" @click="handleSave">
          {{ saving ? '保存中...' : '保存通知配置' }}
        </Button>
      </div>
    </template>
  </FieldGroup>
</template>

<style scoped>
.text-link-blue {
  color: var(--color-link-blue, #0066cc);
}
</style>
