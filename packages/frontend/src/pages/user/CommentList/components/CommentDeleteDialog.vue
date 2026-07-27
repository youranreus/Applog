<script setup lang="ts">
import type { IAdminComment, IDeleteImpact } from '@/types/comment'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
defineProps<{ target?: IAdminComment; impact?: IDeleteImpact; loading?: boolean }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>
<template>
  <Dialog
    :open="Boolean(target)"
    @update:open="
      (open) => {
        if (!open) emit('cancel')
      }
    "
    ><DialogContent
      ><DialogHeader
        ><DialogTitle>确认永久删除？</DialogTitle
        ><DialogDescription v-if="impact"
          >将删除该评论及 {{ impact.descendantCount }} 条后代回复，共
          {{ impact.totalCount }} 条。此操作不可恢复。</DialogDescription
        ><DialogDescription v-else>正在获取最新影响范围…</DialogDescription></DialogHeader
      ><DialogFooter
        ><Button variant="outline" :disabled="loading" @click="emit('cancel')">取消</Button
        ><Button variant="destructive" :disabled="loading || !impact" @click="emit('confirm')"
          >确认删除</Button
        ></DialogFooter
      ></DialogContent
    ></Dialog
  >
</template>
