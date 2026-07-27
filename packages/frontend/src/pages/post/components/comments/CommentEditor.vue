<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    invalid?: boolean
    maxlength?: number
    placeholder?: string
    required?: boolean
  }>(),
  {
    disabled: false,
    invalid: false,
    maxlength: 10000,
    placeholder: '写下你的评论…',
    required: false,
  },
)

const model = defineModel<string>({ default: '' })
const nativeInvalid = shallowRef(false)
const activeInvalid = computed(() => props.invalid || nativeInvalid.value)

function handleInput(event: Event): void {
  nativeInvalid.value = !(event.target as HTMLTextAreaElement).validity.valid
}
</script>

<template>
  <div
    :data-disabled="disabled || undefined"
    :class="
      cn(
        'border-input bg-frost dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 relative rounded-[8px] border transition-colors focus-within:ring-2',
        activeInvalid &&
          'border-destructive ring-destructive/20 focus-within:border-destructive focus-within:ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40 dark:focus-within:border-destructive/50 dark:focus-within:ring-destructive/40 ring-3',
        disabled && 'bg-input/50 dark:bg-input/80',
      )
    "
  >
    <textarea
      v-model="model"
      data-slot="comment-editor"
      class="placeholder:text-muted-foreground min-h-32 w-full resize-y bg-transparent px-2.5 pt-2 pr-28 pb-14 text-base outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
      :aria-invalid="activeInvalid || undefined"
      :disabled="disabled"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :required="required"
      @input="handleInput"
      @invalid="nativeInvalid = true"
    />
    <Button type="submit" size="sm" class="absolute right-2.5 bottom-2.5" :disabled="disabled">
      发送
    </Button>
  </div>
</template>
