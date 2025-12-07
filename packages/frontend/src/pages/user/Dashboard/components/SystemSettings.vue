<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { useRequest } from 'alova/client';
import { kToggle } from 'konsta/vue';
import { useSystemStore } from '@/stores/useSystemStore';
import { setConfig } from '@/api/system-config';
import { getSystemConfigKey, SYSTEM_CONFIG_KEYS, type ISystemBaseConfig } from '@applog/common';
import Input from '@/components/ui/input/index.vue';
import Button from '@/components/ui/button/index.vue';

/**
 * 使用系统配置 Store 获取配置数据
 */
const systemStore = useSystemStore();

/**
 * 表单数据（响应式）
 */
const formData = ref<ISystemBaseConfig>({
  title: '',
  description: '',
  allowUserLogin: true,
  allowComment: true,
});

/**
 * 构建保存配置的请求参数
 * 将表单数据序列化为 JSON 并构建完整的请求参数
 * @returns 请求参数对象
 */
function buildSaveConfigParams() {
  // 构建配置 key（自动添加 SYSTEM_ 前缀）
  const configKey = getSystemConfigKey(SYSTEM_CONFIG_KEYS.BASE_CONFIG);
  
  // 将表单数据序列化为 JSON 字符串
  const configValue = JSON.stringify(formData.value);
  
  return {
    configKey,
    configValue,
    description: '系统基础配置',
    extra: {
      type: 'ISystemBaseConfig',
    },
  };
}

/**
 * 使用 useRequest 处理保存配置请求
 * 不立即请求，需要手动触发
 */
const {
  loading: saving,
  error: saveRequestError,
  send: saveConfigRequest,
} = useRequest(
  () => setConfig(buildSaveConfigParams()),
  {
    immediate: false, // 不立即请求，需要手动触发
  }
);

/**
 * 保存错误信息（从请求错误中提取）
 */
const saveError = computed<string | null>(() => {
  if (!saveRequestError.value) {
    return null;
  }
  
  // 从错误对象中提取错误消息
  if (saveRequestError.value instanceof Error) {
    return saveRequestError.value.message;
  }
  
  return '保存配置失败，请稍后重试';
});

/**
 * 从 store 初始化表单数据
 * 当 store 中的配置加载完成时，将配置数据复制到表单中
 */
function initializeFormData(): void {
  const config = systemStore.config;
  
  if (config) {
    formData.value = {
      title: config.title || '',
      description: config.description || '',
      allowUserLogin: config.allowUserLogin ?? true,
      allowComment: config.allowComment ?? true,
    };
  } else {
    // 如果配置为空，使用默认值
    formData.value = {
      title: '',
      description: '',
      allowUserLogin: true,
      allowComment: true,
    };
  }
  
  // 注意：saveError 是计算属性，会自动从 saveRequestError 中提取
}

/**
 * 监听 store 中的配置变化，自动更新表单数据
 * 当配置加载完成或刷新后，重新初始化表单
 */
watch(
  () => systemStore.config,
  () => {
    if (!systemStore.loading) {
      initializeFormData();
    }
  },
  { immediate: false }
);

/**
 * 组件挂载时初始化表单数据
 */
onMounted(() => {
  if (!systemStore.loading && systemStore.config) {
    initializeFormData();
  }
});

/**
 * 处理保存操作
 * 使用 useRequest 的 send 方法发送请求
 * @returns Promise<void>
 */
async function handleSave(): Promise<void> {
  // 防止重复提交
  if (saving.value) {
    return;
  }

  try {
    // 调用 useRequest 的 send 方法发送请求
    await saveConfigRequest();

    // 保存成功后刷新 store 中的配置
    await systemStore.refreshConfig();
    
    // 显示成功提示（使用 console.log，后续可以替换为 toast）
    console.log('系统配置保存成功');
  } catch (error) {
    // useRequest 会自动处理错误，错误信息会存储在 saveRequestError 中
    // saveError 计算属性会自动提取错误消息
    console.error('保存系统配置失败:', error);
  }
}
</script>

<template>
  <div class="system-settings">
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">系统设置</h2>
      <p class="text-gray-600 text-sm">
        查看和管理系统基础配置
      </p>
    </div>

    <!-- 错误状态 -->
    <div v-if="systemStore.error" class="text-center text-red-600 py-12">
      <p>加载失败，请稍后重试</p>
    </div>

    <!-- 表单编辑 -->
    <div v-else class="space-y-6">
      <!-- 系统标题 -->
      <div>
        <label class="block text-sm font-medium text-gray-900 mb-2">
          系统标题
        </label>
        <Input
          v-model="formData.title"
          type="text"
          placeholder="请输入系统标题"
          :validation-status="saveError ? 'error' : 'normal'"
        />
      </div>

      <!-- 系统描述 -->
      <div>
        <label class="block text-sm font-medium text-gray-900 mb-2">
          系统描述
        </label>
        <Input
          v-model="formData.description"
          type="text"
          placeholder="请输入系统描述"
          :validation-status="saveError ? 'error' : 'normal'"
        />
      </div>

      <!-- 允许用户登录 -->
      <div>
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-900 mb-1">
              允许用户登录
            </label>
            <p class="text-sm text-gray-500">
              控制是否允许用户登录系统
            </p>
          </div>
          <div class="ml-4">
            <k-toggle
              :checked="formData.allowUserLogin"
              @change="formData.allowUserLogin = !formData.allowUserLogin"
            />
          </div>
        </div>
      </div>

      <!-- 允许评论 -->
      <div>
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-900 mb-1">
              允许评论
            </label>
            <p class="text-sm text-gray-500">
              控制是否允许用户发表评论
            </p>
          </div>
          <div class="ml-4">
            <k-toggle
              :checked="formData.allowComment"
              @change="formData.allowComment = !formData.allowComment"
            />
          </div>
        </div>
      </div>

      <!-- 保存错误提示 -->
      <div v-if="saveError" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-sm text-red-600">{{ saveError }}</p>
      </div>

      <!-- 保存按钮 -->
      <div class="flex justify-end">
        <Button
          :disabled="saving || systemStore.loading"
          rounded
          @click="handleSave"
        >
          {{ saving ? '保存中...' : '保存' }}
        </Button>
      </div>
    </div>

    <!-- 无配置 -->
    <div v-if="!systemStore.loading && !systemStore.error && !systemStore.config" class="text-center text-gray-600 py-12">
      <p>暂无系统配置</p>
    </div>
  </div>
</template>

<style scoped>
.system-settings {
  width: 100%;
}
</style>

