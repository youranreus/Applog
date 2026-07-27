<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from 'vue'
import { CheckIcon, MoreHorizontalIcon, Trash2Icon, XIcon } from '@lucide/vue'
import type { IAdminComment } from '@/types/comment'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getAdminCommentLocation } from '../utils/comment-location'
defineProps<{ items: IAdminComment[]; loading?: boolean }>()
const emit = defineEmits<{
  approve: [id: number]
  reject: [id: number]
  delete: [comment: IAdminComment]
}>()
const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN')
const statusText = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }
const statusBadgeClass: Record<IAdminComment['status'], string> = {
  pending: '',
  approved: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
}
const openActionId = shallowRef<number>()
let closeTimer: ReturnType<typeof setTimeout> | undefined

const authorName = (comment: IAdminComment) => comment.author?.name || comment.guestName || '游客'

function cancelClose(): void {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = undefined
}

function openActions(commentId: number): void {
  cancelClose()
  openActionId.value = commentId
}

function scheduleClose(): void {
  cancelClose()
  closeTimer = setTimeout(() => {
    openActionId.value = undefined
  }, 120)
}

function setActionsOpen(commentId: number, open: boolean): void {
  if (open) openActions(commentId)
  else if (openActionId.value === commentId) openActionId.value = undefined
}

function approve(commentId: number): void {
  openActionId.value = undefined
  emit('approve', commentId)
}

function reject(commentId: number): void {
  openActionId.value = undefined
  emit('reject', commentId)
}

function remove(comment: IAdminComment): void {
  openActionId.value = undefined
  emit('delete', comment)
}

onBeforeUnmount(cancelClose)
</script>
<template>
  <div class="table-wrap">
    <table>
      <colgroup>
        <col class="content-column" />
        <col class="post-column" />
        <col class="author-column" />
        <col class="email-column" />
        <col class="audit-column" />
        <col class="ip-column" />
        <col class="action-column" />
      </colgroup>
      <thead>
        <tr>
          <th>评论</th>
          <th>目标 / 父级</th>
          <th>评论者</th>
          <th>邮箱</th>
          <th>审核信息</th>
          <th>IP</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td>
            <p class="content">{{ item.content }}</p>
            <small>{{ formatDate(item.createdAt) }}</small>
          </td>
          <td>
            <RouterLink v-if="item.post || item.page" :to="getAdminCommentLocation(item)!">{{
              item.post?.title || item.page?.title
            }}</RouterLink
            ><span v-else>#{{ item.postId || item.pageId }}</span
            ><small v-if="item.parentId">父评论 #{{ item.parentId }}</small
            ><small v-if="item.descendantCount">{{ item.descendantCount }} 条后代</small>
          </td>
          <td>
            <a
              v-if="item.guestSite"
              class="author-link"
              :href="item.guestSite"
              target="_blank"
              rel="nofollow noopener noreferrer"
              >{{ authorName(item) }}</a
            ><span v-else>{{ authorName(item) }}</span>
          </td>
          <td>
            <span class="truncate-value" :title="item.guestEmail || undefined">{{
              item.guestEmail || '—'
            }}</span>
          </td>
          <td>
            <Badge variant="secondary" :class="statusBadgeClass[item.status]">
              {{ statusText[item.status] }}
            </Badge>
          </td>
          <td>
            <span class="truncate-value" :title="item.ip || undefined">{{ item.ip || '—' }}</span>
          </td>
          <td>
            <div class="actions" @mouseenter="openActions(item.id)" @mouseleave="scheduleClose">
              <Popover
                :open="openActionId === item.id"
                @update:open="setActionsOpen(item.id, $event)"
              >
                <PopoverTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="action-trigger"
                    :disabled="loading"
                    :aria-label="`评论 #${item.id} 操作`"
                  >
                    <MoreHorizontalIcon aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  class="action-menu"
                  align="end"
                  @mouseenter="cancelClose"
                  @mouseleave="scheduleClose"
                >
                  <button
                    type="button"
                    class="action-menu-item"
                    :disabled="loading || item.status === 'approved'"
                    @click="approve(item.id)"
                  >
                    <CheckIcon aria-hidden="true" />
                    <span>通过</span>
                  </button>
                  <button
                    type="button"
                    class="action-menu-item"
                    :disabled="loading || item.status === 'rejected'"
                    @click="reject(item.id)"
                  >
                    <XIcon aria-hidden="true" />
                    <span>拒绝</span>
                  </button>
                  <button
                    type="button"
                    class="action-menu-item destructive-action"
                    :disabled="loading"
                    @click="remove(item)"
                  >
                    <Trash2Icon aria-hidden="true" />
                    <span>删除</span>
                  </button>
                </PopoverContent>
              </Popover>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<style scoped>
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 1rem;
}
table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  table-layout: fixed;
}
.content-column {
  width: 29%;
}
.post-column {
  width: 17%;
}
.author-column {
  width: 12%;
}
.email-column {
  width: 17%;
}
.audit-column {
  width: 10%;
}
.ip-column {
  width: 9%;
}
.action-column {
  width: 6%;
}
th,
td {
  padding: 0.85rem;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--border);
}
th {
  font-size: 0.8rem;
  color: var(--muted-foreground);
}
td {
  font-size: 0.9rem;
}
small {
  display: block;
  margin-top: 0.3rem;
  color: var(--muted-foreground);
}
.content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.truncate-value {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.author-link {
  color: #0066cc;
  text-decoration: none;
}
.author-link:hover {
  text-decoration: underline;
}
.actions {
  display: flex;
  justify-content: center;
}
.action-trigger {
  width: 2rem;
  height: 2rem;
  color: var(--muted-foreground);
}
.action-trigger :deep(svg) {
  width: 1rem;
  height: 1rem;
}
:global(.action-menu) {
  width: 8.5rem;
  gap: 0.2rem;
  padding: 0.35rem;
}
:global(.action-menu-item) {
  display: flex;
  width: 100%;
  min-height: 2rem;
  align-items: center;
  gap: 0.5rem;
  border: 0;
  border-radius: 0.375rem;
  padding: 0.35rem 0.55rem;
  color: var(--foreground);
  background: transparent;
  font-size: 0.82rem;
  text-align: left;
  cursor: pointer;
}
:global(.action-menu-item:hover:not(:disabled)),
:global(.action-menu-item:focus-visible) {
  background: var(--accent);
  outline: none;
}
:global(.action-menu-item:disabled) {
  opacity: 0.45;
  cursor: not-allowed;
}
:global(.action-menu-item svg) {
  width: 0.9rem;
  height: 0.9rem;
}
:global(.destructive-action) {
  color: var(--destructive);
}
</style>
