<script setup lang="ts">
import CommentSection from './CommentSection.vue'

defineOptions({ name: 'PostCommentSection' })
defineProps<{ postId: number }>()
</script>

<template>
  <CommentSection :target="{ type: 'post', id: postId }" />
</template>
