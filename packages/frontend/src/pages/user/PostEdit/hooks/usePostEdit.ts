import { ref, computed, watch, type Ref, type ComputedRef, unref } from 'vue';
import { useRouter } from 'vue-router';
import { useRequest } from 'alova/client';
import { getPostById } from '@/api/post/getPostById';
import { createPost } from '@/api/post/createPost';
import { updatePost } from '@/api/post/updatePost';
import type { IPostDetail, ICreatePostDto, IUpdatePostDto } from '@/types/post';
import { ROUTE_NAMES } from '@/constants/permission';
import { useLayoutStore } from '@/stores/useLayoutStore';

/**
 * 文章编辑 Hook 参数
 */
interface IUsePostEditOptions {
  /** 是否为编辑模式（可以是响应式引用） */
  isEditMode: boolean | Ref<boolean> | ComputedRef<boolean>;
  /** 文章 ID（编辑模式时使用，可以是响应式引用） */
  postId?: string | Ref<string> | ComputedRef<string>;
}

/**
 * 文章编辑 Hook
 * 管理文章编辑状态和业务逻辑，支持创建和编辑两种模式
 * @param options - Hook 配置选项
 * @returns 文章编辑相关的状态和方法
 * 
 * 逻辑说明：
 * 1. 通过传入的 isEditMode 判断是创建模式还是编辑模式
 * 2. 编辑模式：先通过 id 获取文章详情，初始化表单数据
 * 3. 创建模式：使用默认值初始化表单数据
 * 4. 提供保存方法，根据模式调用不同的 API
 * 5. 保存成功后跳转到文章列表
 */
export function usePostEdit(options: IUsePostEditOptions) {
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
   * 文章 ID（响应式）
   */
  const postId = computed(() => {
    return unref(options.postId);
  });

  /**
   * 表单数据（响应式）
   */
  const formData = ref<ICreatePostDto>({
    title: '',
    content: '',
    summary: '',
    cover: '',
    status: 'draft',
    tags: [],
    extra: {},
  });

  /**
   * 当前编辑的文章 ID（编辑模式时使用）
   */
  const currentPostId = ref<number | null>(null);

  /**
   * 使用 useRequest 获取文章详情（编辑模式）
   * 当 isEditMode 为 true 且 postId 存在时，自动获取文章详情
   */
  const {
    loading: loadingPostDetail,
    data: postDetail,
    error: postDetailError,
  } = useRequest(
    () => {
      const idValue = postId.value;
      if (!idValue) {
        throw new Error('文章 ID 无效');
      }
      const id = Number(idValue);
      if (isNaN(id) || id <= 0) {
        throw new Error('文章 ID 无效');
      }
      return getPostById(id);
    },
    {
      immediate: isEditMode.value && !!postId.value,
    }
  );

  /**
   * 监听文章详情数据，初始化表单
   * 当获取到文章详情时，将数据填充到表单中
   */
  watch(
    () => postDetail.value,
    (detail) => {
      if (detail) {
        currentPostId.value = detail.id;
        formData.value = {
          title: detail.title,
          content: detail.content,
          summary: detail.summary || '',
          cover: detail.cover || '',
          status: detail.status,
          tags: detail.tags || [],
          extra: detail.extra || {},
        };
      }
    },
    { immediate: true }
  );

  /**
   * 使用 useRequest 处理创建文章请求
   * 不立即请求，需要手动触发
   */
  const {
    loading: creating,
    error: createError,
    send: createPostRequest,
  } = useRequest(
    () => createPost(formData.value),
    {
      immediate: false,
    }
  );

  /**
   * 使用 useRequest 处理更新文章请求
   * 不立即请求，需要手动触发
   */
  const {
    loading: updating,
    error: updateError,
    send: updatePostRequest,
  } = useRequest(
    () => {
      if (!currentPostId.value) {
        throw new Error('文章 ID 不存在');
      }
      // 构建更新数据，只包含修改的字段
      const updateDto: IUpdatePostDto = {
        title: formData.value.title,
        content: formData.value.content,
        summary: formData.value.summary,
        cover: formData.value.cover,
        status: formData.value.status,
        tags: formData.value.tags,
        extra: formData.value.extra,
      };
      return updatePost(currentPostId.value, updateDto);
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
   * 根据模式调用不同的 API，保存成功后跳转到文章列表
   * @param onSuccess - 成功回调函数
   * @param onError - 错误回调函数
   * @throws {Error} 当保存失败时抛出错误
   */
  async function handleSave(
    onSuccess?: (message: string) => void,
    onError?: (message: string) => void,
  ): Promise<void> {
    try {
      let result: IPostDetail;
      
      if (isEditMode.value) {
        // 编辑模式：更新文章
        if (!currentPostId.value) {
          const errorMsg = '文章 ID 不存在，无法更新';
          onError?.(errorMsg);
          throw new Error(errorMsg);
        }
        result = await updatePostRequest();
        onSuccess?.('文章更新成功');
      } else {
        // 创建模式：创建文章
        result = await createPostRequest();
        onSuccess?.('文章创建成功');
      }
      
      // 保存成功后跳转到文章列表
      router.push({ name: ROUTE_NAMES.USER_POST_LIST });
      // 刷新layoutStore中的文章列表
      layoutStore.refresh();
    } catch (error) {
      // 提取错误消息
      const errorMsg = error instanceof Error ? error.message : '保存失败，请稍后重试';
      onError?.(errorMsg);
      console.error('保存文章失败:', error);
      throw error;
    }
  }

  /**
   * 文章详情数据（只读）
   * 用于显示统计信息
   */
  const currentPostDetail = computed<IPostDetail | undefined>(() => {
    return postDetail.value || undefined;
  });

  return {
    // 表单数据
    formData,
    // 是否为编辑模式
    isEditMode,
    // 文章详情数据
    postDetail: currentPostDetail,
    // 加载文章详情状态
    loadingPostDetail,
    // 文章详情错误
    postDetailError,
    // 保存中状态
    saving,
    // 保存错误信息
    saveError,
    // 保存方法
    handleSave,
  };
}
