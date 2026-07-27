<script setup lang="ts">
import { computed } from 'vue'
import type { ICommentTarget } from '@/types/comment'
import { Button } from '@/components/ui/button'
import { useUserStore } from '@/stores/useUserStore'
import { useSystemStore } from '@/stores/useSystemStore'
import { useComments } from '../../hooks/useComments'
import CommentForm from './CommentForm.vue'
import CommentTree from './CommentTree.vue'
import PostListPagination from '../PostListPagination.vue'

defineOptions({ name: 'CommentSection' })

const props = defineProps<{ target: ICommentTarget }>()
const userStore = useUserStore()
const systemStore = useSystemStore()
const commentsState = useComments(() => props.target)
const commentAllowed = computed(() => systemStore.config?.allowComment !== false)
</script>

<template>
  <section
    class="comment-section"
    aria-labelledby="comments-title"
    :aria-busy="commentsState.loading.value"
  >
    <header class="comment-heading">
      <h2 id="comments-title" class="comment-title">评论</h2>
    </header>
    <p v-if="!commentAllowed" class="comments-closed">
      评论已关闭，已审核的历史评论仍可阅读。
    </p>
    <CommentForm
      v-else
      :reply-target="commentsState.replyTarget.value"
      :disabled="commentsState.submitting.value"
      :authenticated="userStore.isAuthenticated"
      @submit="commentsState.submit"
      @cancel="commentsState.setReplyTarget()"
    />
    <p v-if="commentsState.error.value" class="comment-error" role="alert">
      {{ commentsState.error.value.message }}
      <Button variant="link" @click="commentsState.load">重试</Button>
    </p>
    <p v-else-if="commentsState.loading.value" class="comment-state" aria-live="polite">
      正在加载评论…
    </p>
    <CommentTree
      v-else
      :comments="commentsState.comments.value"
      :withdrawable-ids="commentsState.withdrawableIds.value"
      :withdrawing="commentsState.withdrawing.value"
      @reply="commentsState.setReplyTarget"
      @withdraw="commentsState.withdraw"
    />
    <PostListPagination
      :current-page="commentsState.page.value"
      :total-pages="commentsState.pagination.value?.totalPages || 0"
      :disabled="commentsState.loading.value"
      :on-change="commentsState.setPage"
    />
  </section>
</template>

<style scoped>
.comment-section {
  margin: 4rem 0 6rem;
}
.comment-heading {
  margin-bottom: 1rem;
}
.comment-title {
  margin: 0;
  color: #1d1d1f;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.005em;
}
.comments-closed,
.comment-state,
.comment-error {
  margin: 1rem 0;
  color: #707070;
}
.comment-state {
  min-height: 7rem;
  display: grid;
  place-items: center;
}
</style>
