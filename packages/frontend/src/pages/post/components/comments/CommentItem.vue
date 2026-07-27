<script setup lang="ts">
import type { IPublicComment } from '@/types/comment'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import CommentContent from './CommentContent.vue'

const props = defineProps<{
  comment: IPublicComment
  withdrawableIds?: number[]
  withdrawing?: boolean
}>()
const emit = defineEmits<{
  reply: [comment: IPublicComment]
  withdraw: [commentId: number]
}>()
const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN')
const canWithdraw = (commentId: number) => props.withdrawableIds?.includes(commentId) ?? false
</script>

<template>
  <article :id="`comment-${comment.id}`" class="comment-item" tabindex="-1">
    <div class="avatar-column" aria-hidden="true">
      <img
        v-if="comment.author.avatar"
        class="avatar"
        :src="comment.author.avatar"
        alt=""
        loading="lazy"
      />
      <span v-else class="avatar avatar-fallback">{{ comment.author.name.slice(0, 1) }}</span>
    </div>
    <div class="comment-body">
      <header class="comment-header">
        <a
          v-if="comment.author.site"
          class="author-name"
          :href="comment.author.site"
          target="_blank"
          rel="nofollow noopener noreferrer"
          >{{ comment.author.name }}</a
        >
        <strong v-else class="author-name">{{ comment.author.name }}</strong>
        <time :datetime="comment.createdAt">{{ formatDate(comment.createdAt) }}</time>
        <Badge v-if="comment.status === 'pending'" variant="secondary" class="pending-badge"
          >审核中</Badge
        >
      </header>
      <CommentContent :content="comment.content" />
      <div class="comment-actions">
        <Button
          v-if="comment.status === 'approved'"
          variant="link"
          size="sm"
          class="text-action reply-action"
          :aria-label="`回复评论 #${comment.id}`"
          @click="emit('reply', comment)"
          ><span>回复</span
          ><span class="reply-id" aria-hidden="true">#{{ comment.id }}</span></Button
        >
        <Button
          v-if="canWithdraw(comment.id)"
          variant="link"
          size="sm"
          class="text-action withdraw-action"
          :disabled="withdrawing"
          @click="emit('withdraw', comment.id)"
          >撤回</Button
        >
      </div>
    </div>
    <div v-if="comment.replies?.length" class="comment-replies">
      <CommentItem
        v-for="reply in comment.replies"
        :key="reply.id"
        :comment="reply"
        :withdrawable-ids="withdrawableIds"
        :withdrawing="withdrawing"
        @reply="emit('reply', $event)"
        @withdraw="emit('withdraw', $event)"
      />
    </div>
  </article>
</template>

<style scoped>
.comment-item {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr);
  column-gap: 0.85rem;
  padding: 0.8rem 0;
  border-radius: 8px;
  outline: none;
  transition: background-color 0.25s ease;
}
.avatar-column {
  grid-column: 1;
  grid-row: 1;
}
.avatar {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  object-fit: cover;
  place-items: center;
}
.avatar-fallback {
  color: #707070;
  background: #f5f5f7;
  font-weight: 600;
}
.comment-body {
  grid-column: 2;
  min-width: 0;
}
.comment-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.35rem;
  font-size: 0.8rem;
  color: #707070;
}
.author-name {
  color: #1d1d1f;
  font-weight: 600;
  text-decoration: none;
}
.pending-badge {
  height: 1.25rem;
  padding: 0 0.45rem;
  font-size: 0.7rem;
}
.comment-actions {
  display: flex;
  gap: 0.75rem;
  min-height: 1.75rem;
}
.text-action {
  height: auto;
  padding: 0.2rem 0;
  color: #0066cc;
  font-size: 0.8rem;
}
.reply-id {
  display: inline-block;
  margin-left: 0.35rem;
  opacity: 0;
  transition: opacity 0.18s ease;
}
.reply-action:hover .reply-id,
.reply-action:focus-visible .reply-id {
  opacity: 1;
}
.withdraw-action {
  color: #707070;
}
.comment-replies {
  grid-column: 2;
  margin-top: 0.45rem;
  margin-left: clamp(0.35rem, 2.5vw, 1.5rem);
}
.comment-item:focus-visible {
  box-shadow: 0 0 0 2px #0066cc;
}
.comment-item.is-comment-target {
  background: #f4f8fb;
}
@media (max-width: 640px) {
  .comment-item {
    grid-template-columns: 2.25rem minmax(0, 1fr);
    column-gap: 0.7rem;
    padding: 0.65rem 0;
  }
  .avatar {
    width: 2.25rem;
    height: 2.25rem;
  }
  .comment-replies {
    margin-left: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .comment-item {
    transition: none;
  }
  .reply-id {
    transition: none;
  }
}
</style>
