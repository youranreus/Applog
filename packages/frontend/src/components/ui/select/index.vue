<script setup lang="ts">
import { computed, useAttrs } from 'vue';

/**
 * Select 组件的 Props 接口
 */
interface ISelectProps {
  /**
   * v-model 绑定的值
   * 用于支持 v-model 双向绑定
   */
  modelValue?: string | number;
  /**
   * 校验状态
   * - normal: 正常状态
   * - error: 错误状态（显示红色边框和错误提示）
   * - success: 成功状态
   */
  validationStatus?: 'normal' | 'error' | 'success';
  /**
   * 校验提示信息
   * 当 validationStatus 为 'error' 时，此信息会显示在选择框下方
   */
  validationMessage?: string;
}

const props = withDefaults(defineProps<ISelectProps>(), {
  modelValue: undefined,
  validationStatus: 'normal',
  validationMessage: '',
});

/**
 * Select 组件的事件定义
 */
interface ISelectEmits {
  (e: 'update:modelValue', value: string | number): void;
  (e: 'focus', event: FocusEvent): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'change', event: Event): void;
}

const emit = defineEmits<ISelectEmits>();

const attrs = useAttrs();

/**
 * 计算过滤后的 attrs，排除 value 属性（因为我们已经显式处理了）
 * @returns 过滤后的属性对象
 */
const filteredAttrs = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { value: _value, ...rest } = attrs;
  return rest;
});

/**
 * 计算选择框的值
 * 优先使用 modelValue（v-model），其次使用 attrs.value，最后使用空字符串
 * @returns 选择框的值
 */
const selectValue = computed(() => {
  if (props.modelValue !== undefined) {
    return props.modelValue;
  }
  if (attrs.value !== undefined) {
    return attrs.value as string | number;
  }
  return '';
});

/**
 * 处理变更事件
 * 同时触发 change 事件和 update:modelValue 事件以支持 v-model
 * @param event - 变更事件对象
 */
const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const value = target.value;
  
  emit('change', event);
  emit('update:modelValue', value);
};

/**
 * 计算选择框容器的样式类
 * @returns 样式类字符串
 */
const selectContainerClasses = computed(() => {
  const baseClasses = [
    'flex',
    'items-center',
    'w-full',
    'px-3',
    'py-2',
    'border',
    'rounded-md',
    'transition-colors',
    'duration-200',
    'bg-white',
  ];

  // 根据校验状态添加不同的边框颜色
  if (props.validationStatus === 'error') {
    baseClasses.push('border-red-500', 'focus-within:border-red-600');
  } else if (props.validationStatus === 'success') {
    baseClasses.push('border-green-500', 'focus-within:border-green-600');
  } else {
    baseClasses.push('border-gray-300', 'focus-within:border-gray-500');
  }

  return baseClasses.join(' ');
});

/**
 * 计算选择框的样式类
 * @returns 样式类字符串
 */
const selectClasses = computed(() => {
  return [
    'flex-1',
    'outline-none',
    'bg-transparent',
    'text-gray-900',
    'text-sm',
    'cursor-pointer',
  ].join(' ');
});

/**
 * 计算校验提示信息的样式类
 * @returns 样式类字符串
 */
const validationMessageClasses = computed(() => {
  const baseClasses = ['mt-1', 'text-xs'];

  if (props.validationStatus === 'error') {
    baseClasses.push('text-red-600');
  } else if (props.validationStatus === 'success') {
    baseClasses.push('text-green-600');
  } else {
    baseClasses.push('text-gray-500');
  }

  return baseClasses.join(' ');
});

/**
 * 是否显示校验提示信息
 */
const showValidationMessage = computed(() => {
  return props.validationMessage && props.validationStatus !== 'normal';
});
</script>

<template>
  <div class="select-wrapper">
    <div :class="selectContainerClasses">
      <!-- 前缀 slot -->
      <span v-if="$slots.prefix" class="mr-2 flex items-center text-gray-500">
        <slot name="prefix" />
      </span>

      <!-- 选择框 -->
      <select
        :class="selectClasses"
        :value="selectValue"
        v-bind="filteredAttrs"
        @focus="emit('focus', $event)"
        @blur="emit('blur', $event)"
        @change="handleChange"
      >
        <slot />
      </select>

      <!-- 后缀 slot -->
      <span v-if="$slots.suffix" class="ml-2 flex items-center text-gray-500">
        <slot name="suffix" />
      </span>
    </div>

    <!-- 校验提示信息 -->
    <div v-if="showValidationMessage" :class="validationMessageClasses">
      {{ validationMessage }}
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.select-wrapper {
  @apply w-full;
}

/* 确保选择框在聚焦时保持样式 */
select:focus {
  outline: none;
}

/* 处理 select 的默认样式，移除默认箭头（如果需要自定义箭头，可以通过 suffix slot 实现） */
select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: 2.5rem;
}

/* 禁用状态样式 */
select:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
