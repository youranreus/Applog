<script setup lang="ts">
import { computed, useAttrs } from 'vue';

/**
 * Input 组件的 Props 接口
 */
interface IInputProps {
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
   * 当 validationStatus 为 'error' 时，此信息会显示在输入框下方
   */
  validationMessage?: string;
}

const props = withDefaults(defineProps<IInputProps>(), {
  modelValue: undefined,
  validationStatus: 'normal',
  validationMessage: '',
});

/**
 * Input 组件的事件定义
 */
interface IInputEmits {
  (e: 'update:modelValue', value: string | number): void;
  (e: 'focus', event: FocusEvent): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'input', event: Event): void;
  (e: 'change', event: Event): void;
}

const emit = defineEmits<IInputEmits>();

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
 * 计算输入框的值
 * 优先使用 modelValue（v-model），其次使用 attrs.value，最后使用空字符串
 * @returns 输入框的值
 */
const inputValue = computed(() => {
  if (props.modelValue !== undefined) {
    return props.modelValue;
  }
  if (attrs.value !== undefined) {
    return attrs.value as string | number;
  }
  return '';
});

/**
 * 处理输入事件
 * 同时触发 input 事件和 update:modelValue 事件以支持 v-model
 * @param event - 输入事件对象
 */
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = target.value;
  
  emit('input', event);
  emit('update:modelValue', value);
};

/**
 * 处理变更事件
 * @param event - 变更事件对象
 */
const handleChange = (event: Event) => {
  emit('change', event);
};

/**
 * 计算输入框容器的样式类
 * @returns 样式类字符串
 */
const inputContainerClasses = computed(() => {
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
 * 计算输入框的样式类
 * @returns 样式类字符串
 */
const inputClasses = computed(() => {
  return [
    'flex-1',
    'outline-none',
    'bg-transparent',
    'text-gray-900',
    'placeholder:text-gray-400',
    'text-sm',
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
  <div class="input-wrapper">
    <div :class="inputContainerClasses">
      <!-- 前缀 slot -->
      <span v-if="$slots.prefix" class="mr-2 flex items-center text-gray-500">
        <slot name="prefix" />
      </span>

      <!-- 输入框 -->
      <input
        :class="inputClasses"
        :value="inputValue"
        v-bind="filteredAttrs"
        @focus="emit('focus', $event)"
        @blur="emit('blur', $event)"
        @input="handleInput"
        @change="handleChange"
      />

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

.input-wrapper {
  @apply w-full;
}

/* 确保输入框在聚焦时保持样式 */
input:focus {
  outline: none;
}

/* 确保 placeholder 样式正确 */
input::placeholder {
  opacity: 1;
  transition: opacity 0.2s;
}

input:focus::placeholder {
  opacity: 0.6;
}
</style>

