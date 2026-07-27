<script setup lang="ts">
import AdminListHeader from './components/AdminListHeader.vue'
import AdminListError from './components/AdminListError.vue'
import AdminListEmpty from './components/AdminListEmpty.vue'
import AdminPagination from './components/AdminPagination.vue'
import CommentFilters from './CommentList/components/CommentFilters.vue'
import CommentTable from './CommentList/components/CommentTable.vue'
import CommentDeleteDialog from './CommentList/components/CommentDeleteDialog.vue'
import { useCommentList } from './CommentList/hooks/useCommentList'

const state = useCommentList()
</script>
<template>
  <div class="comment-list-page admin-page-container">
    <AdminListHeader
      title="评论管理"
      create-label="刷新"
      :create-disabled="state.loading.value"
      @create="state.load"
    />
    <CommentFilters
      :status="state.status.value"
      :loading="state.loading.value"
      @change="state.setStatus"
    />
    <AdminListError
      v-if="state.error.value"
      :message="state.error.value.message"
      :loading="state.loading.value"
      @retry="state.load"
    />
    <AdminListEmpty
      v-else-if="!state.loading.value && !state.comments.value.length"
      message="暂无评论。当读者提交评论后，会在这里等待审核。"
    />
    <CommentTable
      v-else
      :items="state.comments.value"
      :loading="state.loading.value || state.moderating.value"
      @approve="state.moderate($event, 'approved')"
      @reject="state.moderate($event, 'rejected')"
      @delete="state.openDelete"
    />
    <AdminPagination
      :pagination="state.pagination.value"
      :loading="state.loading.value"
      @page-change="state.setPage"
    />
    <CommentDeleteDialog
      :target="state.deleteTarget.value"
      :impact="state.deleteImpact.value"
      :loading="state.impactLoading.value || state.deleting.value"
      @cancel="state.closeDelete"
      @confirm="state.confirmDelete"
    />
  </div>
</template>
<style scoped>
.comment-list-page {
  width: 100%;
}
</style>
