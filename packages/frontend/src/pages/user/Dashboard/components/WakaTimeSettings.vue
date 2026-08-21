<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRequest } from 'alova/client'
import {
  DEFAULT_WAKATIME_TIME_ZONE,
  WAKATIME_API_KEY_MASK,
  type IWakaTimeConfig,
} from '@applog/common'
import { getWakaTimeConfig, setWakaTimeConfig } from '@/api/wakatime'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'

const layoutStore = useLayoutStore()
const form = ref<IWakaTimeConfig>({
  apiKey: '',
  timeZone: DEFAULT_WAKATIME_TIME_ZONE,
  enabled: false,
})
const apiKeyDraft = ref('')
const {
  data,
  loading,
  error: loadError,
  send: reload,
} = useRequest(getWakaTimeConfig, { immediate: true })

function applyConfig(config: IWakaTimeConfig): void {
  form.value = {
    apiKey: config.apiKey || '',
    timeZone: config.timeZone || DEFAULT_WAKATIME_TIME_ZONE,
    enabled: config.enabled === true,
  }
  apiKeyDraft.value = ''
}

watch(data, (config) => config && applyConfig(config), { immediate: true })

const enabled = computed({
  get: () => form.value.enabled,
  set: (value: boolean) => {
    form.value.enabled = value
  },
})
const apiKeyPlaceholder = computed(() =>
  form.value.apiKey === WAKATIME_API_KEY_MASK ? '已保存（留空不修改）' : '粘贴 WakaTime API key',
)
const {
  loading: saving,
  error: saveRequestError,
  send: save,
} = useRequest(() => setWakaTimeConfig({ ...form.value, apiKey: apiKeyDraft.value }), {
  immediate: false,
})
const saveError = computed(() => {
  if (!saveRequestError.value) return null
  return saveRequestError.value instanceof Error
    ? saveRequestError.value.message
    : '保存 WakaTime 配置失败，请稍后重试'
})

async function handleSave(): Promise<void> {
  if (saving.value || loading.value) return
  try {
    applyConfig(await save())
    layoutStore.notify({
      title: '保存成功',
      content: 'WakaTime 统计已开始在后台刷新',
      type: 'success',
    })
  } catch (error) {
    layoutStore.notify({
      title: '保存失败',
      content: error instanceof Error ? error.message : '请检查 API key 与 IANA 时区',
      type: 'error',
    })
  }
}
</script>

<template>
  <FieldGroup class="gap-4 border-t border-border pt-8">
    <div>
      <h3 class="text-sm font-semibold text-foreground">编码轨迹 / WakaTime</h3>
      <p class="mt-1 text-xs text-muted-foreground">
        API key 只保存在服务端；Landing 仅读取 30 天脱敏聚合快照。
      </p>
    </div>

    <div v-if="loadError" class="text-sm text-destructive">
      加载 WakaTime 配置失败，
      <button type="button" class="text-link-blue underline" @click="reload">重试</button>
    </div>

    <template v-else>
      <Field orientation="horizontal">
        <div class="flex-1">
          <FieldLabel>在 Landing 展示</FieldLabel>
          <FieldDescription> 关闭或凭证缺失时，Landing 会独立隐藏该区块 </FieldDescription>
        </div>
        <Switch v-model="enabled" />
      </Field>

      <Field>
        <FieldLabel>API key</FieldLabel>
        <Input
          v-model="apiKeyDraft"
          type="password"
          autocomplete="new-password"
          :placeholder="apiKeyPlaceholder"
          :disabled="loading"
        />
        <FieldDescription> 在 WakaTime Settings 中获取；留空表示不修改已保存凭证 </FieldDescription>
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
        <FieldDescription>使用 IANA 时区名称，用于确定 30 个自然日边界</FieldDescription>
      </Field>

      <FieldError v-if="saveError" :errors="[saveError]" />
      <div class="flex justify-end">
        <Button :disabled="saving || loading" @click="handleSave">
          {{ saving ? '保存中...' : '保存 WakaTime 配置' }}
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
