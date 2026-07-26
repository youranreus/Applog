<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import type { DateValue } from '@internationalized/date';
import {
  CalendarDate,
  DateFormatter,
  getLocalTimeZone,
  today,
} from '@internationalized/date';
import { CalendarIcon, XIcon } from '@lucide/vue';
import { useRequest } from 'alova/client';
import { useSystemStore } from '@/stores/useSystemStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useUserStore } from '@/stores/useUserStore';
import { setConfig } from '@/api/system-config';
import { getUmamiConfig, setUmamiConfig } from '@/api/analytics';
import {
  getSystemConfigKey,
  SYSTEM_CONFIG_KEYS,
  UMAMI_PASSWORD_MASK,
  type ISystemBaseConfig,
  type IUmamiConfig,
} from '@applog/common';
import { USER_ROLES } from '@/constants/permission';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import LandingSettingsFields from './LandingSettingsFields.vue';

/**
 * 建站日期展示用格式化器（本地时区）
 */
const siteFoundedDateFormatter = new DateFormatter('zh-CN', {
  dateStyle: 'long',
});

/**
 * 日历默认占位（本地今天）
 */
const calendarDefaultPlaceholder = today(getLocalTimeZone());

/**
 * 日期选择 Popover 开关
 */
const siteFoundedDateOpen = ref(false);

/**
 * 将 YYYY-MM-DD 解析为 CalendarDate
 * @param ymd - ISO 日期字符串
 * @returns 有效日期或 undefined（非法日历日不抛错）
 */
function parseYmdToCalendarDate(ymd: string): DateValue | undefined {
  const trimmed = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return undefined;
  }

  const [yearText, monthText, dayText] = trimmed.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }

  try {
    return new CalendarDate(year, month, day);
  } catch {
    return undefined;
  }
}

/**
 * 将 DateValue 转为 YYYY-MM-DD 存储字符串
 * @param date - 日历选中值
 * @returns ISO 日期或空串
 */
function calendarDateToYmd(date: DateValue | null | undefined): string {
  if (!date) {
    return '';
  }

  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  return `${date.year}-${month}-${day}`;
}

/**
 * 使用系统配置 Store 获取配置数据
 */
const systemStore = useSystemStore();

/**
 * 布局 Store：通知反馈
 */
const layoutStore = useLayoutStore();

/**
 * 表单数据（响应式）
 */
const formData = ref<ISystemBaseConfig>({
  title: '',
  description: '',
  allowUserLogin: true,
  allowComment: true,
  siteFoundedDate: '',
  icpFilingNumber: '',
  landingTitle: '',
  landingBio: '',
  landingSlogan: '',
  weatherCity: '',
  personalHomepageUrl: '/about.html',
  bilibiliUrl: '',
  githubUrl: '',
});

/**
 * 表单绑定的建站日期（Calendar 用 DateValue，只读；写入走 handleSiteFoundedDateSelect）
 */
const siteFoundedCalendarDate = computed<DateValue | undefined>(() => {
  return parseYmdToCalendarDate(formData.value.siteFoundedDate || '');
});

/**
 * 建站日期按钮展示文案
 */
const siteFoundedDateLabel = computed(() => {
  const date = siteFoundedCalendarDate.value;
  if (!date) {
    return '选择建站日期';
  }
  return siteFoundedDateFormatter.format(date.toDate(getLocalTimeZone()));
});

/**
 * 选中日历日期后写入表单并关闭 Popover
 * @param value - 选中的日期
 */
function handleSiteFoundedDateSelect(value: DateValue | undefined): void {
  formData.value.siteFoundedDate = calendarDateToYmd(value);
  siteFoundedDateOpen.value = false;
}

/**
 * 清空建站日期（保存后页脚不再展示运行时间）
 */
function clearSiteFoundedDate(): void {
  formData.value.siteFoundedDate = '';
  siteFoundedDateOpen.value = false;
}

/**
 * 权限变更确认对话框
 */
const permissionConfirmOpen = ref(false);

/**
 * 构建保存配置的请求参数
 * @returns 请求参数对象
 */
function buildSaveConfigParams() {
  const configKey = getSystemConfigKey(SYSTEM_CONFIG_KEYS.BASE_CONFIG);
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
 */
const {
  loading: saving,
  error: saveRequestError,
  send: saveConfigRequest,
} = useRequest(
  () => setConfig(buildSaveConfigParams()),
  {
    immediate: false,
  },
);

/**
 * 保存错误信息（从请求错误中提取）
 */
const saveError = computed<string | null>(() => {
  if (!saveRequestError.value) {
    return null;
  }

  if (saveRequestError.value instanceof Error) {
    return saveRequestError.value.message;
  }

  return '保存配置失败，请稍后重试';
});

/**
 * 是否将关闭用户登录（相对已保存配置）
 */
const willDisableUserLogin = computed(() => {
  const saved = systemStore.config;
  if (!saved) {
    return formData.value.allowUserLogin === false;
  }
  return saved.allowUserLogin === true && formData.value.allowUserLogin === false;
});

/**
 * 是否将关闭评论
 */
const willDisableComment = computed(() => {
  const saved = systemStore.config;
  if (!saved) {
    return formData.value.allowComment === false;
  }
  return saved.allowComment === true && formData.value.allowComment === false;
});

/**
 * 保存前是否需要权限确认
 */
const needsPermissionConfirm = computed(() => {
  return willDisableUserLogin.value || willDisableComment.value;
});

/**
 * 确认对话框说明文案
 */
const permissionConfirmDescription = computed(() => {
  const parts: string[] = [];
  if (willDisableUserLogin.value) {
    parts.push('关闭「允许用户登录」后，非管理员访客将无法登录。');
  }
  if (willDisableComment.value) {
    parts.push('关闭「允许评论」后，公开文章将无法发表新评论。');
  }
  parts.push('确定要保存这些更改吗？');
  return parts.join(' ');
});

/**
 * 从 store 初始化表单数据
 */
function initializeFormData(): void {
  const config = systemStore.config;

  if (config) {
    formData.value = {
      title: config.title || '',
      description: config.description || '',
      allowUserLogin: config.allowUserLogin ?? true,
      allowComment: config.allowComment ?? true,
      siteFoundedDate: config.siteFoundedDate || '',
      icpFilingNumber: config.icpFilingNumber || '',
      landingTitle: config.landingTitle || '',
      landingBio: config.landingBio,
      landingSlogan: config.landingSlogan,
      weatherCity: config.weatherCity || '',
      personalHomepageUrl: config.personalHomepageUrl ?? '/about.html',
      bilibiliUrl: config.bilibiliUrl || '',
      githubUrl: config.githubUrl,
    };
  } else {
    formData.value = {
      title: '',
      description: '',
      allowUserLogin: true,
      allowComment: true,
      siteFoundedDate: '',
      icpFilingNumber: '',
      landingTitle: '',
      landingBio: '',
      landingSlogan: '',
      weatherCity: '',
      personalHomepageUrl: '/about.html',
      bilibiliUrl: '',
      githubUrl: '',
    };
  }
}

watch(
  () => systemStore.config,
  () => {
    if (!systemStore.loading) {
      initializeFormData();
    }
  },
  { immediate: false },
);

onMounted(() => {
  if (!systemStore.loading && systemStore.config) {
    initializeFormData();
  }
});

/**
 * 从未知错误中提取可读消息
 * @param err - 捕获到的错误
 * @returns 面向用户的错误文案
 */
function getSaveErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (saveError.value) {
    return saveError.value;
  }
  return '保存配置失败，请稍后重试';
}

/**
 * 执行实际保存请求并反馈结果
 */
async function persistConfig(): Promise<void> {
  if (saving.value) {
    return;
  }

  try {
    await saveConfigRequest();
    await systemStore.refreshConfig();
    layoutStore.notify({
      title: '保存成功',
      content: '系统配置已更新',
      type: 'success',
    });
  } catch (error) {
    console.error('保存系统配置失败:', error);
    layoutStore.notify({
      title: '保存失败',
      content: getSaveErrorMessage(error),
      type: 'error',
    });
  }
}

/**
 * 处理保存：危险权限变更时先确认
 */
async function handleSave(): Promise<void> {
  if (saving.value || systemStore.loading) {
    return;
  }

  if (needsPermissionConfirm.value) {
    permissionConfirmOpen.value = true;
    return;
  }

  await persistConfig();
}

/**
 * 取消权限确认
 */
function handleCancelPermissionConfirm(): void {
  permissionConfirmOpen.value = false;
}

/**
 * 确认后保存
 */
async function handleConfirmPermissionSave(): Promise<void> {
  permissionConfirmOpen.value = false;
  await persistConfig();
}

/**
 * 当前用户是否为管理员（Umami 完整配置仅 admin）
 */
const userStore = useUserStore();
const isAdmin = computed(() => userStore.user?.role === USER_ROLES.ADMIN);

/**
 * Umami 对接表单
 */
const umamiForm = ref<IUmamiConfig>({
  baseUrl: '',
  websiteId: '',
  scriptUrl: '',
  username: '',
  password: '',
  enabled: true,
});

/**
 * 拉取脱敏 Umami 配置（仅 admin 请求，避免非管理员触发鉴权失败）
 */
const {
  loading: umamiLoading,
  data: umamiConfigData,
  error: umamiLoadError,
  send: reloadUmamiConfig,
} = useRequest(getUmamiConfig, {
  immediate: false,
});

/**
 * 管理员进入系统设置时再拉取 Umami 配置
 */
watch(
  isAdmin,
  (admin) => {
    if (admin) {
      void reloadUmamiConfig();
    }
  },
  { immediate: true },
);

/**
 * 密码输入草稿（与脱敏占位分离，避免清空误写）
 */
const umamiPasswordDraft = ref('');

/**
 * 将接口数据写入表单
 * @param data - 脱敏配置
 */
function applyUmamiForm(data: IUmamiConfig): void {
  umamiForm.value = {
    baseUrl: data.baseUrl || '',
    websiteId: data.websiteId || '',
    scriptUrl: data.scriptUrl || '',
    username: data.username || '',
    password: data.password || '',
    enabled: data.enabled !== false,
  };
  umamiPasswordDraft.value = '';
}

watch(
  umamiConfigData,
  (data) => {
    if (data) {
      applyUmamiForm(data);
    }
  },
  { immediate: true },
);

/**
 * 保存 Umami 配置请求
 */
const {
  loading: umamiSaving,
  error: umamiSaveRequestError,
  send: saveUmamiRequest,
} = useRequest(
  () =>
    setUmamiConfig({
      ...umamiForm.value,
      // 空草稿 = 不修改已存密码
      password: umamiPasswordDraft.value,
    }),
  {
    immediate: false,
  },
);

/**
 * Umami 保存错误文案
 */
const umamiSaveError = computed<string | null>(() => {
  if (!umamiSaveRequestError.value) {
    return null;
  }
  if (umamiSaveRequestError.value instanceof Error) {
    return umamiSaveRequestError.value.message;
  }
  return '保存 Umami 配置失败，请稍后重试';
});

/**
 * 启用开关（保证 boolean）
 */
const umamiEnabled = computed({
  get: () => umamiForm.value.enabled !== false,
  set: (value: boolean) => {
    umamiForm.value.enabled = value;
  },
});

/**
 * 密码字段占位提示
 */
const umamiPasswordPlaceholder = computed(() =>
  umamiForm.value.password === UMAMI_PASSWORD_MASK
    ? '已保存（留空不修改）'
    : '请输入密码',
);

/**
 * 保存 Umami 对接配置
 */
async function handleSaveUmami(): Promise<void> {
  if (umamiSaving.value) {
    return;
  }

  try {
    const saved = await saveUmamiRequest();
    applyUmamiForm(saved);
    layoutStore.notify({
      title: '保存成功',
      content: 'Umami 对接已更新，无需重新构建前端',
      type: 'success',
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : umamiSaveError.value || '保存 Umami 配置失败，请稍后重试';
    layoutStore.notify({
      title: '保存失败',
      content: message,
      type: 'error',
    });
  }
}
</script>

<template>
  <div class="system-settings">
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-foreground mb-2">系统设置</h2>
      <p class="text-muted-foreground text-sm">
        管理站点基础信息与访问权限
      </p>
    </div>

    <div v-if="systemStore.error" class="text-center text-destructive py-12">
      <p class="mb-4">加载失败，请稍后重试</p>
      <Button variant="outline" @click="systemStore.refreshConfig()">
        重试
      </Button>
    </div>

    <div v-else class="space-y-8">
      <FieldGroup class="gap-4">
        <h3 class="text-sm font-semibold text-foreground">站点信息</h3>
        <Field>
          <FieldLabel>系统标题</FieldLabel>
          <Input
            v-model="formData.title"
            type="text"
            placeholder="请输入系统标题"
          />
        </Field>

        <Field>
          <FieldLabel>系统描述</FieldLabel>
          <Input
            v-model="formData.description"
            type="text"
            placeholder="请输入系统描述"
          />
        </Field>

        <Field>
          <FieldLabel>建站日期</FieldLabel>
          <div class="flex items-center gap-2">
            <Popover v-model:open="siteFoundedDateOpen">
              <PopoverTrigger as-child>
                <Button
                  type="button"
                  variant="outline"
                  :class="cn(
                    'h-8 w-full max-w-xs justify-start rounded-[8px] border-input bg-frost px-2.5 font-normal text-foreground shadow-none hover:bg-frost',
                    !siteFoundedCalendarDate && 'text-muted-foreground',
                  )"
                >
                  <CalendarIcon class="size-4 opacity-60" />
                  {{ siteFoundedDateLabel }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0" align="start">
                <Calendar
                  :model-value="siteFoundedCalendarDate"
                  :default-placeholder="calendarDefaultPlaceholder"
                  layout="month-and-year"
                  @update:model-value="handleSiteFoundedDateSelect"
                />
              </PopoverContent>
            </Popover>
            <Button
              v-if="siteFoundedCalendarDate"
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="清除建站日期"
              @click="clearSiteFoundedDate"
            >
              <XIcon class="size-4" />
            </Button>
          </div>
          <FieldDescription>
            配置后将在页面底部展示实时运行时间；清空后不展示
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>备案号</FieldLabel>
          <Input
            v-model="formData.icpFilingNumber"
            type="text"
            placeholder="如 粤ICP备xxxxxxxx号"
          />
          <FieldDescription>
            配置后将在页面底部展示，点击跳转至工信部备案查询；清空后不展示
          </FieldDescription>
        </Field>
      </FieldGroup>

      <LandingSettingsFields
        v-model:landing-title="formData.landingTitle"
        v-model:landing-bio="formData.landingBio"
        v-model:landing-slogan="formData.landingSlogan"
        v-model:weather-city="formData.weatherCity"
        v-model:personal-homepage-url="formData.personalHomepageUrl"
        v-model:bilibili-url="formData.bilibiliUrl"
        v-model:github-url="formData.githubUrl"
      />

      <FieldGroup class="gap-4">
        <h3 class="text-sm font-semibold text-foreground">访问与互动</h3>
        <Field orientation="horizontal">
          <div class="flex-1">
            <FieldLabel>允许用户登录</FieldLabel>
            <FieldDescription>
              关闭后，访客将无法登录（请确认你仍能管理站点）
            </FieldDescription>
          </div>
          <Switch v-model="formData.allowUserLogin" />
        </Field>

        <Field orientation="horizontal">
          <div class="flex-1">
            <FieldLabel>允许评论</FieldLabel>
            <FieldDescription>
              关闭后，公开内容将无法发表新评论
            </FieldDescription>
          </div>
          <Switch v-model="formData.allowComment" />
        </Field>
      </FieldGroup>

      <FieldError v-if="saveError" :errors="[saveError]" />

      <div class="flex justify-end">
        <Button
          :disabled="saving || systemStore.loading"
          @click="handleSave"
        >
          {{ saving ? '保存中...' : '保存' }}
        </Button>
      </div>

      <FieldGroup
        v-if="isAdmin"
        class="gap-4 border-t border-border pt-8"
      >
        <div>
          <h3 class="text-sm font-semibold text-foreground">流量分析 / Umami</h3>
          <p class="mt-1 text-xs text-muted-foreground">
            对接自建 Umami 实例。保存后即时生效，无需重新构建。实例部署、Geo 与
            IGNORE_IP 由运维侧完成。
          </p>
        </div>

        <div v-if="umamiLoadError" class="text-sm text-destructive">
          加载 Umami 配置失败，
          <button
            type="button"
            class="underline text-link-blue"
            @click="reloadUmamiConfig"
          >
            重试
          </button>
        </div>

        <template v-else>
          <Field orientation="horizontal">
            <div class="flex-1">
              <FieldLabel>启用 Tracker</FieldLabel>
              <FieldDescription>
                关闭后访客不再加载统计脚本；Dashboard 查询仍需凭证齐备
              </FieldDescription>
            </div>
            <Switch v-model="umamiEnabled" />
          </Field>

          <Field>
            <FieldLabel>Umami 地址</FieldLabel>
            <Input
              v-model="umamiForm.baseUrl"
              type="url"
              placeholder="https://umami.example.com"
              :disabled="umamiLoading"
            />
            <FieldDescription>无尾斜杠；用于 API 与默认 script 推导</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Website ID</FieldLabel>
            <Input
              v-model="umamiForm.websiteId"
              type="text"
              placeholder="Website UUID"
              :disabled="umamiLoading"
            />
          </Field>

          <Field>
            <FieldLabel>Script URL（可选）</FieldLabel>
            <Input
              v-model="umamiForm.scriptUrl"
              type="url"
              placeholder="留空则使用 {baseUrl}/script.js"
              :disabled="umamiLoading"
            />
          </Field>

          <Field>
            <FieldLabel>用户名</FieldLabel>
            <Input
              v-model="umamiForm.username"
              type="text"
              autocomplete="off"
              :disabled="umamiLoading"
            />
          </Field>

          <Field>
            <FieldLabel>密码</FieldLabel>
            <Input
              v-model="umamiPasswordDraft"
              type="password"
              autocomplete="new-password"
              :placeholder="umamiPasswordPlaceholder"
              :disabled="umamiLoading"
            />
            <FieldDescription>
              读回为脱敏态；留空表示不修改已保存密码
            </FieldDescription>
          </Field>

          <FieldError v-if="umamiSaveError" :errors="[umamiSaveError]" />

          <div class="flex justify-end">
            <Button
              :disabled="umamiSaving || umamiLoading"
              @click="handleSaveUmami"
            >
              {{ umamiSaving ? '保存中...' : '保存 Umami 配置' }}
            </Button>
          </div>
        </template>
      </FieldGroup>
    </div>

    <Dialog v-model:open="permissionConfirmOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认更改访问权限？</DialogTitle>
          <DialogDescription>
            {{ permissionConfirmDescription }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="handleCancelPermissionConfirm">
            取消
          </Button>
          <Button :disabled="saving" @click="handleConfirmPermissionSave">
            确认保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.system-settings {
  width: 100%;
}

.text-link-blue {
  color: var(--color-link-blue, #0066cc);
}
</style>
