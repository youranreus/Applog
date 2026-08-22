<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRequest } from 'alova/client'
import {
  FLOMO_TOKEN_MASK,
  type IFlomoAdminConfig,
  type IFlomoAdminStatus,
} from '@applog/common'
import {
  getFlomoConfig,
  getFlomoStatus,
  setFlomoConfig,
  syncFlomoNow,
} from '@/api/flomo'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'

const layoutStore = useLayoutStore()
const form = ref({ enabled: false, token: '', publicationTags: '' })
const sync = ref<IFlomoAdminStatus>({
  status: 'never_synced',
  lastAttemptedAt: null,
  lastSuccessfulAt: null,
  publicMemoCount: 0,
  errorCategory: null,
})
let pollingTimer: ReturnType<typeof setTimeout> | undefined
let disposed = false

const { data, loading, error: loadError, send: reload } = useRequest(getFlomoConfig, {
  immediate: true,
})
const { loading: saving, error: saveRequestError, send: save } = useRequest(
  () =>
    setFlomoConfig({
      enabled: form.value.enabled,
      token: form.value.token,
      publicationTags: form.value.publicationTags.split('\n'),
    }),
  { immediate: false },
)
const { loading: startingSync, send: startSync } = useRequest(syncFlomoNow, {
  immediate: false,
})
const { send: loadStatus } = useRequest(getFlomoStatus, { immediate: false })

function applyConfig(config: IFlomoAdminConfig): void {
  form.value = {
    enabled: config.enabled,
    token: config.token,
    publicationTags: config.publicationTags.join('\n'),
  }
  sync.value = config.sync
  if (sync.value.status === 'syncing') schedulePoll()
}

watch(data, (value) => value && applyConfig(value), { immediate: true })

const enabled = computed({
  get: () => form.value.enabled,
  set: (value: boolean) => {
    form.value.enabled = value
  },
})
const tokenPlaceholder = computed(() =>
  form.value.token === FLOMO_TOKEN_MASK ? '已加密保存（留空或保持掩码不修改）' : 'Bearer token',
)
const saveError = computed(() => {
  if (!saveRequestError.value) return null
  return saveRequestError.value instanceof Error
    ? saveRequestError.value.message
    : '保存 Flomo 配置失败，请稍后重试'
})
const statusText = computed(() => ({
  never_synced: '尚未同步',
  syncing: '同步中',
  healthy: '正常',
  degraded: '同步异常（保留同策略下的上次快照）',
  reauth_required: '需要更新凭证',
}[sync.value.status]))
const diagnosticText = computed(() => {
  if (!sync.value.errorCategory) return null
  return ({
    unauthorized: '凭证已失效或无权访问',
    rate_limited: '上游限流，请稍后重试',
    timeout: '上游请求超时',
    schema: '上游数据格式发生变化',
    compatibility: '私有接口兼容性异常',
    upstream: '上游服务暂时不可用',
    internal: '同步内部异常',
    interrupted: '上次同步被进程中断',
    configuration_changed: '同步期间配置已变化，正在等待新策略同步',
  } as Record<string, string>)[sync.value.errorCategory] ?? '同步异常'
})

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN')
}

function schedulePoll(): void {
  if (disposed) return
  if (pollingTimer) clearTimeout(pollingTimer)
  pollingTimer = setTimeout(() => void pollStatus(), 1_500)
}

async function pollStatus(): Promise<void> {
  try {
    sync.value = await loadStatus()
    if (sync.value.status === 'syncing') schedulePoll()
  } catch {
    schedulePoll()
  }
}

async function handleSave(): Promise<void> {
  if (saving.value || loading.value) return
  try {
    const config = await save()
    applyConfig(config)
    if (config.enabled) schedulePoll()
    layoutStore.notify({
      title: '保存成功',
      content: '发布策略已更新；来源变化会在后台执行全量同步',
      type: 'success',
    })
  } catch (error) {
    layoutStore.notify({
      title: '保存失败',
      content: error instanceof Error ? error.message : '请检查 token 与发布标签',
      type: 'error',
    })
  }
}

async function handleSync(): Promise<void> {
  if (startingSync.value || sync.value.status === 'syncing') return
  try {
    const result = await startSync()
    sync.value = { ...sync.value, status: 'syncing' }
    schedulePoll()
    layoutStore.notify({
      title: result.alreadyRunning ? '同步已在进行' : '已开始同步',
      content: '可留在此页查看状态，公开请求不会访问 Flomo',
      type: 'success',
    })
  } catch (error) {
    layoutStore.notify({
      title: '无法开始同步',
      content: error instanceof Error ? error.message : '请稍后重试',
      type: 'error',
    })
  }
}

onBeforeUnmount(() => {
  disposed = true
  if (pollingTimer) clearTimeout(pollingTimer)
})
</script>

<template>
  <FieldGroup class="gap-4 border-t border-border pt-8">
    <div>
      <h3 class="text-sm font-semibold text-foreground">公开笔记 / Flomo</h3>
      <p class="mt-1 text-xs text-muted-foreground">
        私有 Web 接口可能变化；token 仅在服务端加密保存。公开页只读取已清洗的数据库快照。
      </p>
    </div>

    <div v-if="loadError" class="text-sm text-destructive">
      加载 Flomo 配置失败，
      <button type="button" class="text-link-blue underline" @click="reload">重试</button>
    </div>

    <template v-else>
      <Field orientation="horizontal">
        <div class="flex-1">
          <FieldLabel>公开笔记页</FieldLabel>
          <FieldDescription>关闭后公开 API 立即返回空列表，但不会删除已保存快照</FieldDescription>
        </div>
        <Switch v-model="enabled" :disabled="loading" />
      </Field>

      <Field>
        <FieldLabel>Bearer token</FieldLabel>
        <Input
          v-model="form.token"
          type="password"
          autocomplete="new-password"
          :placeholder="tokenPlaceholder"
          :disabled="loading"
        />
        <FieldDescription>可粘贴带或不带 Bearer 前缀的 token；留空或保持掩码表示不修改</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>精确发布标签</FieldLabel>
        <Textarea
          v-model="form.publicationTags"
          rows="4"
          placeholder="公开\n博客/随笔"
          :disabled="loading"
        />
        <FieldDescription>
          每行一个，可省略开头 #；任一精确匹配即发布，父标签不会自动包含子标签
        </FieldDescription>
      </Field>

      <dl class="flomo-status" aria-live="polite">
        <div><dt>状态</dt><dd>{{ statusText }}</dd></div>
        <div v-if="diagnosticText"><dt>诊断</dt><dd>{{ diagnosticText }}</dd></div>
        <div><dt>公开笔记</dt><dd>{{ sync.publicMemoCount }}</dd></div>
        <div><dt>最近尝试</dt><dd>{{ formatDate(sync.lastAttemptedAt) }}</dd></div>
        <div><dt>最近成功</dt><dd>{{ formatDate(sync.lastSuccessfulAt) }}</dd></div>
      </dl>

      <FieldError v-if="saveError" :errors="[saveError]" />
      <div class="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          :disabled="startingSync || loading || !form.enabled || sync.status === 'syncing'"
          @click="handleSync"
        >
          {{ sync.status === 'syncing' ? '同步中…' : '立即同步' }}
        </Button>
        <Button :disabled="saving || loading" @click="handleSave">
          {{ saving ? '保存中…' : '保存 Flomo 配置' }}
        </Button>
      </div>
    </template>
  </FieldGroup>
</template>

<style scoped>
.text-link-blue { color: var(--color-link-blue); }
.flomo-status {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--color-pebble);
  border-radius: var(--radius-cards);
  background: var(--color-frost);
}
.flomo-status dt { color: var(--muted-foreground); font-size: 0.7rem; }
.flomo-status dd { margin-top: 0.15rem; color: var(--foreground); font-size: 0.82rem; }
@media (max-width: 540px) { .flomo-status { grid-template-columns: 1fr; } }
</style>
