<script setup lang="ts">
import { reactive } from 'vue'
import type { IPublicComment } from '@/types/comment'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const props = defineProps<{
  replyTarget?: IPublicComment
  disabled?: boolean
  authenticated?: boolean
}>()
const emit = defineEmits<{
  submit: [
    payload: { content: string; guestName?: string; guestEmail?: string; guestSite?: string },
  ]
  cancel: []
}>()
const form = reactive({ content: '', guestName: '', guestEmail: '', guestSite: '' })

function submit(): void {
  if (!form.content.trim()) return
  if (!props.authenticated && (!form.guestName.trim() || !form.guestEmail.trim())) return
  emit('submit', {
    content: form.content,
    guestName: form.guestName || undefined,
    guestEmail: form.guestEmail || undefined,
    guestSite: form.guestSite || undefined,
  })
  form.content = ''
}
</script>
<template>
  <form class="comment-form" @submit.prevent="submit">
    <div v-if="replyTarget" class="replying">
      <span>正在回复 {{ replyTarget.author.name }} #{{ replyTarget.id }}</span>
      <Button type="button" variant="link" size="sm" @click="emit('cancel')">取消</Button>
    </div>
    <Textarea
      v-model="form.content"
      :disabled="disabled"
      maxlength="10000"
      required
      placeholder="写下你的评论…"
    />
    <div v-if="!authenticated" class="guest-fields">
      <Input
        v-model="form.guestName"
        :disabled="disabled"
        maxlength="200"
        required
        placeholder="昵称"
      />
      <Input
        v-model="form.guestEmail"
        :disabled="disabled"
        type="email"
        required
        placeholder="邮箱（不会公开）"
      />
      <Input
        v-model="form.guestSite"
        :disabled="disabled"
        type="url"
        placeholder="个人网站（可选）"
      />
    </div>
    <Button type="submit" :disabled="disabled">提交评论</Button>
  </form>
</template>
<style scoped>
.comment-form {
  display: grid;
  gap: 0.8rem;
  margin: 1.25rem 0 2rem;
}
.guest-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}
.replying {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.9rem;
  color: var(--muted-foreground);
}
@media (max-width: 640px) {
  .guest-fields {
    grid-template-columns: 1fr;
  }
}
</style>
