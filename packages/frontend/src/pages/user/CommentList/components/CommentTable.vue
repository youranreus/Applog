<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from 'vue'
import { CheckIcon, MoreHorizontalIcon, Trash2Icon, XIcon } from '@lucide/vue'
import type { IAdminComment } from '@/types/comment'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getAdminCommentLocation } from '../utils/comment-location'

defineProps<{
  items: IAdminComment[]
  loading?: boolean
}>()

const emit = defineEmits<{
  approve: [id: number]
  reject: [id: number]
  delete: [comment: IAdminComment]
}>()

const STATUS_TEXT = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
} as const

const openActionId = shallowRef<number>()
let closeTimer: ReturnType<typeof setTimeout> | undefined

/**
 * 格式化评论创建日期（仅日期，对齐文章/页面管理表）
 * @param value - ISO 时间字符串
 * @returns 本地化日期
 */
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * 解析评论展示名
 * @param comment - 后台评论项
 * @returns 作者名或游客名
 */
function authorName(comment: IAdminComment): string {
  return comment.author?.name || comment.guestName || '游客'
}

/**
 * 解析目标展示标题（无标题时返回空，由模板回退为 #id）
 * @param comment - 后台评论项
 * @returns 文章/页面标题，或空字符串
 */
function targetTitle(comment: IAdminComment): string {
  return comment.post?.title || comment.page?.title || ''
}

/**
 * 取消操作菜单延迟关闭
 */
function cancelClose(): void {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = undefined
}

/**
 * 打开指定评论的操作菜单
 * @param commentId - 评论 ID
 */
function openActions(commentId: number): void {
  cancelClose()
  openActionId.value = commentId
}

/**
 * 延迟关闭操作菜单，避免移入 Popover 时闪断
 */
function scheduleClose(): void {
  cancelClose()
  closeTimer = setTimeout(() => {
    openActionId.value = undefined
  }, 120)
}

/**
 * 同步 Popover 开关状态
 * @param commentId - 评论 ID
 * @param open - 是否打开
 */
function setActionsOpen(commentId: number, open: boolean): void {
  if (open) openActions(commentId)
  else if (openActionId.value === commentId) openActionId.value = undefined
}

/**
 * 通过评论
 * @param commentId - 评论 ID
 */
function approve(commentId: number): void {
  openActionId.value = undefined
  emit('approve', commentId)
}

/**
 * 拒绝评论
 * @param commentId - 评论 ID
 */
function reject(commentId: number): void {
  openActionId.value = undefined
  emit('reject', commentId)
}

/**
 * 删除评论
 * @param comment - 评论项
 */
function remove(comment: IAdminComment): void {
  openActionId.value = undefined
  emit('delete', comment)
}

onBeforeUnmount(cancelClose)
</script>

<template>
  <div class="admin-content-table">
    <div class="admin-content-table__scroll">
      <table class="admin-content-table__table">
        <thead>
          <tr>
            <th
              scope="col"
              class="admin-content-table__col-meta"
            >
              时间
            </th>
            <th scope="col">评论</th>
            <th
              scope="col"
              class="admin-content-table__col-target"
            >
              目标
            </th>
            <th
              scope="col"
              class="admin-content-table__col-author"
            >
              评论者
            </th>
            <th
              scope="col"
              class="admin-content-table__col-email"
            >
              邮箱
            </th>
            <th
              scope="col"
              class="admin-content-table__col-status"
            >
              状态
            </th>
            <th
              scope="col"
              class="admin-content-table__col-ip"
            >
              IP
            </th>
            <th
              scope="col"
              class="admin-content-table__col-action"
            >
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            class="admin-content-table__row"
          >
            <td class="admin-content-table__col-meta admin-content-table__meta">
              {{ formatDate(item.createdAt) }}
            </td>
            <td>
              <p class="admin-content-table__content">{{ item.content }}</p>
            </td>
            <td class="admin-content-table__col-target">
              <RouterLink
                v-if="targetTitle(item)"
                class="admin-content-table__target-link"
                :to="getAdminCommentLocation(item)!"
              >
                {{ targetTitle(item) }}
              </RouterLink>
              <span
                v-else
                class="admin-content-table__truncate"
              >#{{ item.postId || item.pageId }}</span>
            </td>
            <td class="admin-content-table__col-author">
              <a
                v-if="item.guestSite"
                class="admin-content-table__author-link"
                :href="item.guestSite"
                target="_blank"
                rel="nofollow noopener noreferrer"
              >
                {{ authorName(item) }}
              </a>
              <span v-else>{{ authorName(item) }}</span>
            </td>
            <td class="admin-content-table__col-email">
              <span
                class="admin-content-table__truncate"
                :title="item.guestEmail || undefined"
              >
                {{ item.guestEmail || '—' }}
              </span>
            </td>
            <td class="admin-content-table__col-status">
              <span
                class="admin-content-table__status"
                :data-status="item.status"
              >
                {{ STATUS_TEXT[item.status] }}
              </span>
            </td>
            <td class="admin-content-table__col-ip">
              <span
                class="admin-content-table__truncate"
                :title="item.ip || undefined"
              >
                {{ item.ip || '—' }}
              </span>
            </td>
            <td class="admin-content-table__col-action">
              <div
                class="admin-content-table__actions"
                @mouseenter="openActions(item.id)"
                @mouseleave="scheduleClose"
              >
                <Popover
                  :open="openActionId === item.id"
                  @update:open="setActionsOpen(item.id, $event)"
                >
                  <PopoverTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="admin-content-table__action-trigger"
                      :disabled="loading"
                      :aria-label="`评论 #${item.id} 操作`"
                    >
                      <MoreHorizontalIcon aria-hidden="true" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    class="comment-action-menu"
                    align="end"
                    @mouseenter="cancelClose"
                    @mouseleave="scheduleClose"
                  >
                    <button
                      type="button"
                      class="comment-action-menu__item"
                      :disabled="loading || item.status === 'approved'"
                      @click="approve(item.id)"
                    >
                      <CheckIcon aria-hidden="true" />
                      <span>通过</span>
                    </button>
                    <button
                      type="button"
                      class="comment-action-menu__item"
                      :disabled="loading || item.status === 'rejected'"
                      @click="reject(item.id)"
                    >
                      <XIcon aria-hidden="true" />
                      <span>拒绝</span>
                    </button>
                    <button
                      type="button"
                      class="comment-action-menu__item comment-action-menu__item--destructive"
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
  </div>
</template>

<style scoped>
.admin-content-table {
  width: 100%;
  border: 1px solid var(--color-pebble, #e2e2e5);
  border-radius: var(--radius-cards, 8px);
  background: #ffffff;
  overflow: hidden;
}

.admin-content-table__scroll {
  overflow-x: auto;
}

.admin-content-table__table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
}

.admin-content-table__table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-graphite, #474747);
  background: var(--color-frost, #f5f5f7);
  border-bottom: 1px solid var(--color-pebble, #e2e2e5);
}

.admin-content-table__table td {
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  color: var(--color-carbon, #1d1d1f);
  border-bottom: 1px solid var(--color-pebble, #e2e2e5);
  vertical-align: middle;
}

.admin-content-table__row:last-child td {
  border-bottom: none;
}

.admin-content-table__col-meta,
.admin-content-table__col-status,
.admin-content-table__col-action {
  width: 1%;
  white-space: nowrap;
  padding-inline: 0.75rem;
}

.admin-content-table__col-target,
.admin-content-table__col-author,
.admin-content-table__col-email,
.admin-content-table__col-ip {
  width: 1%;
  min-width: 7rem;
  max-width: 12rem;
  padding-inline: 0.75rem;
}

.admin-content-table__meta {
  color: var(--color-ash, #707070);
}

.admin-content-table__content {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.admin-content-table__target-link {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-carbon, #1d1d1f);
  text-decoration: none;
  font-weight: 500;
}

.admin-content-table__target-link:hover {
  color: var(--color-apple-blue, #0071e3);
  text-decoration: underline;
}

.admin-content-table__author-link {
  color: var(--color-link-blue, #0066cc);
  text-decoration: none;
}

.admin-content-table__author-link:hover {
  text-decoration: underline;
}

.admin-content-table__truncate {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-content-table__status {
  display: inline-block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-smoke, #333333);
}

.admin-content-table__status[data-status='pending']::before,
.admin-content-table__status[data-status='approved']::before,
.admin-content-table__status[data-status='rejected']::before {
  content: '';
  display: inline-block;
  width: 0.375rem;
  height: 0.375rem;
  margin-right: 0.4rem;
  border-radius: 999px;
  vertical-align: 0.05em;
  background: var(--color-mist, #858585);
}

.admin-content-table__status[data-status='approved']::before {
  background: var(--color-apple-blue, #0071e3);
}

.admin-content-table__status[data-status='pending']::before {
  background: var(--color-ash, #707070);
}

.admin-content-table__status[data-status='rejected']::before {
  background: var(--destructive, #dc2626);
}

.admin-content-table__actions {
  display: flex;
  justify-content: center;
}

.admin-content-table__action-trigger {
  width: 2rem;
  height: 2rem;
  color: var(--color-ash, #707070);
}

.admin-content-table__action-trigger :deep(svg) {
  width: 1rem;
  height: 1rem;
}

@media (max-width: 768px) {
  .admin-content-table__table th,
  .admin-content-table__table td {
    padding: 0.625rem 0.75rem;
  }
}
</style>

<style>
.comment-action-menu {
  width: 8.5rem;
  gap: 0.2rem;
  padding: 0.35rem;
}

.comment-action-menu__item {
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

.comment-action-menu__item:hover:not(:disabled),
.comment-action-menu__item:focus-visible {
  background: var(--accent);
  outline: none;
}

.comment-action-menu__item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.comment-action-menu__item svg {
  width: 0.9rem;
  height: 0.9rem;
}

.comment-action-menu__item--destructive {
  color: var(--destructive);
}
</style>
