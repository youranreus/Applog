/**
 * Photos 组件 Props
 */
export interface IProps {
  /** BBCode 标签内的图片元数据文本 */
  content: string;
}

/**
 * 图片项数据结构
 */
export interface IPhotoItem {
  /** 图片描述 */
  description: string;
  /** 图片链接 */
  url: string;
  /** 图片宽度（加载后获取） */
  width?: number;
  /** 图片高度（加载后获取） */
  height?: number;
  /** flex-grow 值 */
  flexGrow?: number;
  /** 计算后的高度（px） */
  calculatedHeight?: number;
}
