import { ref, computed, watch, type Ref, type ComputedRef, unref } from 'vue';
import { useRouter } from 'vue-router';
import { useRequest } from 'alova/client';
import { getPageBySlug } from '@/api/page/getPageBySlug';
import { createPage } from '@/api/page/createPage';
import { updatePage } from '@/api/page/updatePage';
import type { IPageDetail, ICreatePageDto, IUpdatePageDto } from '@/types/page';
import { ROUTE_NAMES } from '@/constants/permission';
import { useLayoutStore } from '@/stores/useLayoutStore';

/**
 * 页面编辑 Hook 参数
 */
interface IUsePageEditOptions {
  /** 是否为编辑模式（可以是响应式引用） */
  isEditMode: boolean | Ref<boolean> | ComputedRef<boolean>;
  /** 页面 Slug（编辑模式时使用，可以是响应式引用） */
  pageSlug?: string | Ref<string> | ComputedRef<string>;
}

/**
 * 页面编辑 Hook
 * 管理页面编辑状态和业务逻辑，支持创建和编辑两种模式
 * @param options - Hook 配置选项
 * @returns 页面编辑相关的状态和方法
 * 
 * 逻辑说明：
 * 1. 通过传入的 isEditMode 判断是创建模式还是编辑模式
 * 2. 编辑模式：先通过 slug 获取页面详情，初始化表单数据
 * 3. 创建模式：使用默认值初始化表单数据
 * 4. 提供保存方法，根据模式调用不同的 API
 * 5. 保存成功后跳转到页面列表
 */
export function usePageEdit(options: IUsePageEditOptions) {
  /**
   * 路由实例
   */
  const router = useRouter();

  /**
   * 布局 Store
   */
  const layoutStore = useLayoutStore();

  /**
   * 是否为编辑模式（响应式）
   */
  const isEditMode = computed(() => {
    return unref(options.isEditMode);
  });

  /**
   * 页面 Slug（响应式）
   */
  const pageSlug = computed(() => {
    return unref(options.pageSlug);
  });

  /**
   * 表单数据（响应式）
   */
  const formData = ref<ICreatePageDto>({
    title: '',
    content: '',
    summary: '',
    cover: '',
    slug: '',
    status: 'draft',
    showInNav: false,
    showInFooter: false,
    tags: [],
    extra: {},
  });

  /**
   * 当前编辑的页面 ID（编辑模式时使用）
   */
  const pageId = ref<number | null>(null);

  /**
   * 使用 useRequest 获取页面详情（编辑模式）
   * 当 isEditMode 为 true 且 slug 存在时，自动获取页面详情
   */
  const {
    loading: loadingPageDetail,
    data: pageDetail,
    error: pageDetailError,
  } = useRequest(
    () => {
      return getPageBySlug(pageSlug.value!);
    },
    {
      immediate: isEditMode.value && !!pageSlug.value,
    }
  );

  /**
   * 监听页面详情数据，初始化表单
   * 当获取到页面详情时，将数据填充到表单中
   */
  watch(
    () => pageDetail.value,
    (detail) => {
      if (detail) {
        pageId.value = detail.id;
        formData.value = {
          title: detail.title,
          content: detail.content,
          summary: detail.summary || '',
          cover: detail.cover || '',
          slug: detail.slug,
          status: detail.status,
          showInNav: detail.showInNav,
          showInFooter: detail.showInFooter,
          tags: detail.tags || [],
          extra: detail.extra || {},
        };
      }
    },
    { immediate: true }
  );

  /**
   * 使用 useRequest 处理创建页面请求
   * 不立即请求，需要手动触发
   */
  const {
    loading: creating,
    error: createError,
    send: createPageRequest,
  } = useRequest(
    () => createPage(formData.value),
    {
      immediate: false,
    }
  );

  /**
   * 使用 useRequest 处理更新页面请求
   * 不立即请求，需要手动触发
   */
  const {
    loading: updating,
    error: updateError,
    send: updatePageRequest,
  } = useRequest(
    () => {
      if (!pageId.value) {
        throw new Error('页面 ID 不存在');
      }
      // 构建更新数据，只包含修改的字段
      const updateDto: IUpdatePageDto = {
        title: formData.value.title,
        content: formData.value.content,
        summary: formData.value.summary,
        cover: formData.value.cover,
        slug: formData.value.slug,
        status: formData.value.status,
        showInNav: formData.value.showInNav,
        showInFooter: formData.value.showInFooter,
        tags: formData.value.tags,
        extra: formData.value.extra,
      };
      return updatePage(pageId.value, updateDto);
    },
    {
      immediate: false,
    }
  );

  /**
   * 保存错误信息（从请求错误中提取）
   */
  const saveError = computed<string | null>(() => {
    const error = isEditMode.value ? updateError.value : createError.value;
    if (!error) {
      return null;
    }
    
    // 从错误对象中提取错误消息
    if (error instanceof Error) {
      return error.message;
    }
    
    return '保存失败，请稍后重试';
  });

  /**
   * 保存中状态
   */
  const saving = computed(() => {
    return isEditMode.value ? updating.value : creating.value;
  });

  /**
   * 处理保存操作
   * 根据模式调用不同的 API，保存成功后跳转到页面列表
   * @param onSuccess - 成功回调函数
   * @param onError - 错误回调函数
   * @throws {Error} 当保存失败时抛出错误
   */
  async function handleSave(
    onSuccess?: (message: string) => void,
    onError?: (message: string) => void,
  ): Promise<void> {
    try {
      let result: IPageDetail;
      
      if (isEditMode.value) {
        // 编辑模式：更新页面
        if (!pageId.value) {
          const errorMsg = '页面 ID 不存在，无法更新';
          onError?.(errorMsg);
          throw new Error(errorMsg);
        }
        result = await updatePageRequest();
        onSuccess?.('页面更新成功');
      } else {
        // 创建模式：创建页面
        result = await createPageRequest();
        onSuccess?.('页面创建成功');
      }
      
      // 保存成功后跳转到页面列表
      router.push({ name: ROUTE_NAMES.USER_PAGE_LIST });
      // 刷新layoutStore中的页面列表
      layoutStore.refresh();
    } catch (error) {
      // 提取错误消息
      const errorMsg = error instanceof Error ? error.message : '保存失败，请稍后重试';
      onError?.(errorMsg);
      console.error('保存页面失败:', error);
      throw error;
    }
  }

  /**
   * 页面详情数据（只读）
   * 用于显示统计信息
   */
  const currentPageDetail = computed<IPageDetail | undefined>(() => {
    return pageDetail.value || undefined;
  });

  return {
    // 表单数据
    formData,
    // 是否为编辑模式
    isEditMode,
    // 页面详情数据
    pageDetail: currentPageDetail,
    // 加载页面详情状态
    loadingPageDetail,
    // 页面详情错误
    pageDetailError,
    // 保存中状态
    saving,
    // 保存错误信息
    saveError,
    // 保存方法
    handleSave,
  };
}
