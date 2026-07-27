<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { ICommentMigrationResult, IMigrationDatabaseConfig } from '@/types/migration'

const props = defineProps<{
  open: boolean
  loading?: boolean
  result?: ICommentMigrationResult
  error?: Error
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  submit: [dbConfig: IMigrationDatabaseConfig]
}>()

function createDefaultDatabaseConfig(): IMigrationDatabaseConfig {
  return {
    host: '',
    port: 3306,
    database: '',
    username: '',
    password: '',
    tablePrefix: 'typecho_',
  }
}

const form = reactive<IMigrationDatabaseConfig>(createDefaultDatabaseConfig())

function resetForm(): void {
  Object.assign(form, createDefaultDatabaseConfig())
}

function handlePortUpdate(value: string | number): void {
  const port = Number(value)
  if (Number.isFinite(port)) form.port = port
}

function submit(): void {
  emit('submit', {
    host: form.host.trim(),
    port: form.port,
    database: form.database.trim(),
    username: form.username.trim(),
    password: form.password,
    tablePrefix: form.tablePrefix?.trim() || undefined,
  })
}

watch(
  () => props.open,
  (open) => {
    if (open) resetForm()
  },
)
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg" :show-close-button="!loading">
      <form class="grid gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>迁移 Typecho 评论</DialogTitle>
          <DialogDescription>
            连接远程 Typecho 数据库，仅补充迁移评论。已有评论不会被清空或覆盖。
          </DialogDescription>
        </DialogHeader>

        <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field>
            <FieldLabel for="migration-host">数据库地址</FieldLabel>
            <Input
              id="migration-host"
              v-model="form.host"
              autocomplete="off"
              :disabled="loading"
              placeholder="127.0.0.1"
              required
            />
          </Field>
          <Field>
            <FieldLabel for="migration-port">端口</FieldLabel>
            <Input
              id="migration-port"
              :model-value="form.port"
              type="number"
              min="1"
              max="65535"
              :disabled="loading"
              required
              @update:model-value="handlePortUpdate"
            />
          </Field>
          <Field>
            <FieldLabel for="migration-database">数据库名</FieldLabel>
            <Input
              id="migration-database"
              v-model="form.database"
              autocomplete="off"
              :disabled="loading"
              placeholder="typecho"
              required
            />
          </Field>
          <Field>
            <FieldLabel for="migration-prefix">表前缀</FieldLabel>
            <Input
              id="migration-prefix"
              v-model="form.tablePrefix"
              autocomplete="off"
              :disabled="loading"
              placeholder="typecho_"
              pattern="[A-Za-z0-9_]+"
            />
          </Field>
          <Field>
            <FieldLabel for="migration-username">用户名</FieldLabel>
            <Input
              id="migration-username"
              v-model="form.username"
              autocomplete="username"
              :disabled="loading"
              required
            />
          </Field>
          <Field>
            <FieldLabel for="migration-password">密码</FieldLabel>
            <Input
              id="migration-password"
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              :disabled="loading"
            />
            <FieldDescription>数据库无密码时可留空。</FieldDescription>
          </Field>
        </div>

        <FieldDescription>
          评论依赖已迁移文章或页面的 Typecho 原始 ID；找不到对应目标的评论会跳过并计入结果。
        </FieldDescription>

        <p v-if="error" class="text-destructive m-0" role="alert">{{ error.message }}</p>

        <section
          v-if="result"
          class="bg-muted grid gap-2.5 rounded-xl border p-3.5"
          aria-live="polite"
        >
          <h3 class="m-0 font-semibold">迁移结果</h3>
          <dl class="m-0 grid grid-cols-3 gap-2">
            <div class="grid gap-0.5">
              <dt class="text-muted-foreground text-xs">新增</dt>
              <dd class="m-0 font-semibold">{{ result.data.commentsImported }}</dd>
            </div>
            <div class="grid gap-0.5">
              <dt class="text-muted-foreground text-xs">已存在</dt>
              <dd class="m-0 font-semibold">{{ result.data.commentsExisting }}</dd>
            </div>
            <div class="grid gap-0.5">
              <dt class="text-muted-foreground text-xs">缺少文章</dt>
              <dd class="m-0 font-semibold">{{ result.data.commentsMissingPost }}</dd>
            </div>
            <div class="grid gap-0.5">
              <dt class="text-muted-foreground text-xs">缺少页面</dt>
              <dd class="m-0 font-semibold">{{ result.data.commentsMissingPage }}</dd>
            </div>
            <div class="grid gap-0.5">
              <dt class="text-muted-foreground text-xs">缺少父评论</dt>
              <dd class="m-0 font-semibold">{{ result.data.commentsMissingParent }}</dd>
            </div>
            <div class="grid gap-0.5">
              <dt class="text-muted-foreground text-xs">类型跳过</dt>
              <dd class="m-0 font-semibold">{{ result.data.commentsSkippedByType }}</dd>
            </div>
            <div class="grid gap-0.5">
              <dt class="text-muted-foreground text-xs">目标类型跳过</dt>
              <dd class="m-0 font-semibold">{{ result.data.commentsSkippedByTargetType }}</dd>
            </div>
            <div class="grid gap-0.5">
              <dt class="text-muted-foreground text-xs">状态跳过</dt>
              <dd class="m-0 font-semibold">{{ result.data.commentsSkippedByStatus }}</dd>
            </div>
            <div class="grid gap-0.5">
              <dt class="text-muted-foreground text-xs">失败</dt>
              <dd class="m-0 font-semibold">{{ result.data.commentsFailed }}</dd>
            </div>
          </dl>
          <p class="text-muted-foreground m-0 text-xs">耗时 {{ result.data.duration }}</p>
        </section>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="loading"
            @click="emit('update:open', false)"
          >
            关闭
          </Button>
          <Button type="submit" :disabled="loading">
            {{ loading ? '迁移中…' : result ? '再次迁移' : '开始迁移' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
