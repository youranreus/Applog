<script setup lang="ts">
import type { IPublicComment } from '@/types/comment'
import CommentItem from './CommentItem.vue'
defineProps<{ comments: IPublicComment[]; withdrawableIds?: number[]; withdrawing?: boolean }>()
defineEmits<{ reply: [comment: IPublicComment]; withdraw: [commentId: number] }>()
</script>
<template>
  <div v-if="comments.length">
    <CommentItem
      v-for="comment in comments"
      :key="comment.id"
      :comment="comment"
      :withdrawable-ids="withdrawableIds"
      :withdrawing="withdrawing"
      @reply="$emit('reply', $event)"
      @withdraw="$emit('withdraw', $event)"
    />
  </div>
  <p v-else class="empty-comments">还没有评论，来留下第一句话吧。</p>
</template>
<style scoped>
.empty-comments {
  padding: 2rem 0;
  color: var(--muted-foreground);
  text-align: center;
}
</style>
