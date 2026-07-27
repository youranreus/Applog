<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRequest } from 'alova/client';
import {
  DEFAULT_DUOLINGO_TIME_ZONE,
  DUOLINGO_JWT_MASK,
  type IDuolingoConfig,
} from '@applog/common';
import {
  getDuolingoConfig,
  setDuolingoConfig,
} from '@/api/duolingo';
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
const form = ref<IDuolingoConfig>({
  username: '',
  jwt: '',
  timeZone: DEFAULT_DUOLINGO_TIME_ZONE,
  enabled: false,
});
const jwtDraft = ref('');

const {
  data,
  loading,
  error: loadError,
  send: reload,
} = useRequest(getDuolingoConfig, { immediate: true });

function applyConfig(config: IDuolingoConfig): void {
  form.value = {
    username: config.username || '',
    jwt: config.jwt || '',
    timeZone: config.timeZone || DEFAULT_DUOLINGO_TIME_ZONE,
    enabled: config.enabled === true,
  };
  jwtDraft.value = '';
}

watch(data, (config) => config && applyConfig(config), { immediate: true });

const enabled = computed({
  get: () => form.value.enabled,
  set: (value: boolean) => {
    form.value.enabled = value;
  },
});
const jwtPlaceholder = computed(() =>
  form.value.jwt === DUOLINGO_JWT_MASK
    ? '已保存（留空不修改）'
    : '粘贴 Duolingo JWT',
);

const {
  loading: saving,
  error: saveRequestError,
  send: save,
} = useRequest(
  () =>
    setDuolingoConfig({
      ...form.value,
      jwt: jwtDraft.value,
    }),
  { immediate: false },
);
const saveError = computed(() => {
  if (!saveRequestError.value) return null;
  return saveRequestError.value instanceof Error
    ? saveRequestError.value.message
    : '保存 Duolingo 配置失败，请稍后重试';
});

async function handleSave(): Promise<void> {
  if (saving.value || loading.value) return;
  try {
    const saved = await save();
    applyConfig(saved);
    layoutStore.notify({
      title: '保存成功',
      content: 'Duolingo 学习统计已更新，无需重新构建前端',
      type: 'success',
    });
  } catch (error) {
    layoutStore.notify({
      title: '保存失败',
      content:
        error instanceof Error
          ? error.message
          : '请检查用户名、JWT 与 IANA 时区后重试',
      type: 'error',
    });
  }
}
</script>

<template>
  <FieldGroup class="gap-4 border-t border-border pt-8">
    <div>
      <h3 class="text-sm font-semibold text-foreground">学习轨迹 / Duolingo</h3>
      <p class="mt-1 text-xs text-muted-foreground">
        服务端每 30 分钟更新一次公开聚合数据；JWT 只保存在服务端并脱敏读回。
      </p>
    </div>

    <div v-if="loadError" class="text-sm text-destructive">
      加载 Duolingo 配置失败，
      <button
        type="button"
        class="text-link-blue underline"
        @click="reload"
      >
        重试
      </button>
    </div>

    <template v-else>
      <Field orientation="horizontal">
        <div class="flex-1">
          <FieldLabel>在 Landing 展示</FieldLabel>
          <FieldDescription>
            关闭、用户名为空或 JWT 缺失时，Landing 会隐藏整个学习统计区块
          </FieldDescription>
        </div>
        <Switch v-model="enabled" />
      </Field>

      <Field>
        <FieldLabel>Duolingo 用户名</FieldLabel>
        <Input
          v-model="form.username"
          type="text"
          autocomplete="off"
          placeholder="公开用户名"
          :disabled="loading"
        />
      </Field>

      <Field>
        <FieldLabel>JWT</FieldLabel>
        <Input
          v-model="jwtDraft"
          type="password"
          autocomplete="new-password"
          :placeholder="jwtPlaceholder"
          :disabled="loading"
        />
        <FieldDescription>
          JWT 过期时在此粘贴新值；留空表示不修改已保存凭证
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>展示时区</FieldLabel>
        <Input
          v-model="form.timeZone"
          type="text"
          autocomplete="off"
          placeholder="Asia/Shanghai"
          :disabled="loading"
        />
        <FieldDescription>
          使用 IANA 时区名称，用于确定自然日与年度边界
        </FieldDescription>
      </Field>

      <FieldError v-if="saveError" :errors="[saveError]" />

      <div class="flex justify-end">
        <Button :disabled="saving || loading" @click="handleSave">
          {{ saving ? '保存中...' : '保存 Duolingo 配置' }}
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
