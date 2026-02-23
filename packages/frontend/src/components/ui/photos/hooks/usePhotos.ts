import { ref, computed, readonly } from 'vue';
import type { IProps, IPhotoItem } from '../types';
import { parsePhotoContent, calculatePhotoStyle } from '../utils';
import { LAYOUT_BASE } from '../constants';

/**
 * Photos 组件的逻辑层
 * @param props - 组件 props
 * @returns 组件状态和方法
 * 
 * 逻辑说明：
 * 1. 状态定义：管理图片项列表
 * 2. 业务逻辑：解析内容、加载图片、计算布局样式
 * 3. 生命周期：组件挂载时初始化
 */
export function usePhotos(props: IProps) {
  // ========== 状态定义区 ==========
  /**
   * 图片项列表
   */
  const photoItems = ref<IPhotoItem[]>([]);

  /**
   * 已加载完成的图片数量（用于 img @load 计数）
   */
  const loadedImageCount = ref<number>(0);

  /**
   * 图片总数（解析 content 后得到）
   */
  const totalImageCount = ref<number>(0);

  /**
   * 是否所有图片均已预加载完成（通过 new Image() 预加载，图片已进入浏览器缓存）
   */
  const allImagesLoaded = computed<boolean>(
    () =>
      totalImageCount.value > 0 &&
      loadedImageCount.value >= totalImageCount.value,
  );

  /**
   * 更新图片项列表
   * @param items - 新的图片项列表
   */
  const setPhotoItems = (items: IPhotoItem[]): void => {
    photoItems.value = items;
  };

  // ========== 业务逻辑区 ==========

  /**
   * 解析 content prop 生成初始图片项
   * @returns 解析后的图片项数组
   */
  const parseContent = (): IPhotoItem[] => {
    const parsed = parsePhotoContent(props.content);
    return parsed.map((item) => ({
      description: item.description,
      url: item.url,
    }));
  };

  /**
   * 加载单张图片并计算布局样式
   * @param item - 图片项
   * @param index - 图片项索引
   * 
   * 逻辑说明：
   * 1. 创建 Image 对象加载图片
   * 2. 图片加载完成后获取宽高
   * 3. 计算 flexGrow 和 calculatedHeight
   * 4. 更新对应索引的图片项
   */
  const loadPhotoImage = (item: IPhotoItem, index: number): void => {
    const img = new Image();
    img.src = item.url;
    img.onload = () => {
      const { flexGrow, calculatedHeight } = calculatePhotoStyle(
        img.width,
        img.height,
        LAYOUT_BASE,
      );

      // 更新对应索引的图片项
      const newItems = [...photoItems.value];
      newItems[index] = {
        ...item,
        width: img.width,
        height: img.height,
        flexGrow,
        calculatedHeight,
      };
      setPhotoItems(newItems);

      // 预加载完成计数：图片已进入浏览器缓存，可直接渲染
      loadedImageCount.value += 1;
    };
    img.onerror = () => {
      // 加载失败也计数，避免 allImagesLoaded 永远不触发
      loadedImageCount.value += 1;
    };
  };

  /**
   * 处理所有图片加载
   * 
   * 逻辑说明：
   * 1. 先解析 content 生成初始图片项
   * 2. 为每张图片创建加载任务
   */
  const handleAllPhotosLoad = (): void => {
    const items = parseContent();
    loadedImageCount.value = 0;
    totalImageCount.value = items.length;
    setPhotoItems(items);

    // 为每张图片加载并计算样式
    items.forEach((item, index) => {
      loadPhotoImage(item, index);
    });
  };

  // ========== 生命周期函数区 ==========

  /**
   * 组件挂载时的初始化逻辑
   * 
   * 逻辑说明：
   * 1. 解析 content prop
   * 2. 加载所有图片并计算布局样式
   */
  const handleMounted = (): void => {
    handleAllPhotosLoad();
  };

  return {
    // 状态（readonly）
    photoItems: readonly(photoItems),
    allImagesLoaded,
    // 业务逻辑
    handleMounted,
  };
}
