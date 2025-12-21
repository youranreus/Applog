import { ref } from 'vue';

/**
 * 标签编辑 Hook 参数
 */
interface IUseTagEditorOptions {
  /** 获取标签数组的函数 */
  getTags: () => string[];
  /** 设置标签数组的函数 */
  setTags: (tags: string[]) => void;
}

/**
 * 标签编辑 Hook
 * 管理标签编辑的状态和业务逻辑，包括添加、删除标签和对话框控制
 * @param options - Hook 配置选项
 * @returns 标签编辑相关的状态和方法
 * 
 * 逻辑说明：
 * 1. 接收 tags 的响应式引用，直接操作原数组
 * 2. 管理新增标签对话框的显示状态
 * 3. 管理新增标签的输入值
 * 4. 提供添加标签方法（包含验证：非空、去重、trim）
 * 5. 提供删除标签方法（通过索引删除）
 * 6. 提供打开/关闭对话框的方法
 */
export function useTagEditor(options: IUseTagEditorOptions) {
  /**
   * 获取标签数组的函数
   */
  const getTags = options.getTags;

  /**
   * 设置标签数组的函数
   */
  const setTags = options.setTags;

  /**
   * 新增标签对话框显示状态
   */
  const showAddTagDialog = ref<boolean>(false);

  /**
   * 新增标签输入值
   */
  const newTagInput = ref<string>('');

  /**
   * 添加新标签
   * 验证标签名称（非空、去重），通过验证后添加到标签数组
   * 
   * 逻辑说明：
   * 1. 对输入值进行 trim 处理
   * 2. 验证标签名称不能为空
   * 3. 验证标签不能重复（不区分大小写）
   * 4. 通过验证后添加到标签数组
   * 5. 清空输入并关闭对话框
   */
  function handleAddTag(): void {
    // 获取当前标签数组
    const currentTags = getTags();
    
    // 确保 tags 是数组
    const tags = Array.isArray(currentTags) ? [...currentTags] : [];

    // 获取处理后的标签名称
    const tagName = newTagInput.value.trim();

    // 验证：标签名称不能为空
    if (!tagName) {
      return;
    }

    // 验证：标签不能重复（不区分大小写）
    const tagExists = tags.some(
      (tag) => tag.toLowerCase() === tagName.toLowerCase()
    );
    if (tagExists) {
      // 标签已存在，清空输入但不关闭对话框，让用户修改
      newTagInput.value = '';
      return;
    }

    // 添加标签到数组
    tags.push(tagName);

    // 更新标签数组
    setTags(tags);

    // 清空输入并关闭对话框
    newTagInput.value = '';
    showAddTagDialog.value = false;
  }

  /**
   * 删除标签
   * 根据索引从标签数组中删除指定标签
   * @param index - 要删除的标签索引
   * 
   * 逻辑说明：
   * 1. 验证索引是否有效
   * 2. 使用 splice 方法删除指定索引的标签
   */
  function handleDeleteTag(index: number): void {
    // 获取当前标签数组
    const currentTags = getTags();
    
    // 确保 tags 是数组
    const tags = Array.isArray(currentTags) ? [...currentTags] : [];
    
    if (tags.length === 0) {
      return;
    }

    // 验证索引是否有效
    if (index < 0 || index >= tags.length) {
      return;
    }

    // 删除指定索引的标签
    tags.splice(index, 1);

    // 更新标签数组
    setTags(tags);
  }

  /**
   * 打开新增标签对话框
   * 重置输入值并显示对话框
   * 
   * 逻辑说明：
   * 1. 清空输入值
   * 2. 显示对话框
   */
  function handleOpenAddTagDialog(): void {
    newTagInput.value = '';
    showAddTagDialog.value = true;
  }

  /**
   * 关闭新增标签对话框
   * 清空输入值并隐藏对话框
   * 
   * 逻辑说明：
   * 1. 清空输入值
   * 2. 隐藏对话框
   */
  function handleCloseAddTagDialog(): void {
    newTagInput.value = '';
    showAddTagDialog.value = false;
  }

  return {
    // 对话框显示状态
    showAddTagDialog,
    // 新增标签输入值
    newTagInput,
    // 添加标签方法
    handleAddTag,
    // 删除标签方法
    handleDeleteTag,
    // 打开对话框方法
    handleOpenAddTagDialog,
    // 关闭对话框方法
    handleCloseAddTagDialog,
  };
}

