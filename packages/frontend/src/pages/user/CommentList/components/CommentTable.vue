<script setup lang="ts">
import type { IAdminComment } from '@/types/comment'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getAdminCommentLocation } from '../utils/comment-location'
defineProps<{ items: IAdminComment[]; loading?: boolean }>()
defineEmits<{ approve: [id: number]; reject: [id: number]; delete: [comment: IAdminComment] }>()
const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN')
const statusText = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }
</script>
<template>
  <div class="table-wrap">
    <table>
      <colgroup>
        <col class="content-column" />
        <col class="post-column" />
        <col class="author-column" />
        <col class="audit-column" />
        <col class="action-column" />
      </colgroup>
      <thead>
        <tr>
          <th>评论</th>
          <th>文章 / 父级</th>
          <th>评论者</th>
          <th>审核信息</th>
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
            <RouterLink v-if="item.post" :to="getAdminCommentLocation(item)!">{{
              item.post.title
            }}</RouterLink
            ><span v-else>#{{ item.postId }}</span
            ><small v-if="item.parentId">父评论 #{{ item.parentId }}</small
            ><small v-if="item.descendantCount">{{ item.descendantCount }} 条后代</small>
          </td>
          <td>
            <span>{{ item.author?.name || item.guestName || '游客' }}</span
            ><small>{{ item.guestEmail || '登录用户' }}</small
            ><small v-if="item.guestSite">{{ item.guestSite }}</small>
          </td>
          <td>
            <Badge variant="secondary">{{ statusText[item.status] }}</Badge
            ><small v-if="item.ip">IP {{ item.ip }}</small
            ><small
              v-if="item.agent"
              class="agent"
              tabindex="0"
              :title="item.agent"
              :aria-label="`User-Agent：${item.agent}`"
              >{{ item.agent }}</small
            >
          </td>
          <td>
            <div class="actions">
              <Button
                size="sm"
                :disabled="loading || item.status === 'approved'"
                @click="$emit('approve', item.id)"
                >通过</Button
              ><Button
                size="sm"
                variant="outline"
                :disabled="loading || item.status === 'rejected'"
                @click="$emit('reject', item.id)"
                >拒绝</Button
              ><Button
                size="sm"
                variant="destructive"
                :disabled="loading"
                @click="$emit('delete', item)"
                >删除</Button
              >
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
  width: 34%;
}
.post-column {
  width: 18%;
}
.author-column {
  width: 17%;
}
.audit-column {
  width: 14%;
}
.action-column {
  width: 17%;
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
.agent {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.agent:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}
.actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.3rem;
}
.actions :deep(button) {
  height: 1.9rem;
  padding-inline: 0.55rem;
  font-size: 0.78rem;
}
</style>
