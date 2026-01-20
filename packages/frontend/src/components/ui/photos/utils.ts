import { LAYOUT_BASE } from './constants';

/**
 * 解析图片元数据文本
 * @param content - BBCode 标签内的文本内容
 * @returns 解析后的图片项数组，包含 description 和 url
 * 
 * 逻辑说明：
 * 1. 使用 | 分割不同的图片元数据
 * 2. 过滤空字符串
 * 3. 使用 , 分割描述和 URL
 * 4. 返回解析后的数组
 */
export function parsePhotoContent(
  content: string,
): Array<{ description: string; url: string }> {
  return content
    .split('|')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => {
      const [description, url] = item.split(',').map((s) => s.trim());
      return { description: description || '', url: url || '' };
    });
}

/**
 * 计算图片布局样式
 * @param width - 图片宽度
 * @param height - 图片高度
 * @param base - 布局基准值，默认为 LAYOUT_BASE
 * @returns 包含 flexGrow 和 calculatedHeight 的对象
 * 
 * 逻辑说明：
 * 1. flexGrow = (width * base) / height - 用于 flex 布局中的增长系数（也是容器宽度）
 * 2. calculatedHeight = base - 根据布局逻辑，高度固定为基准值，保持统一的展示高度
 */
export function calculatePhotoStyle(
  width: number,
  height: number,
  base: number = LAYOUT_BASE,
): {
  flexGrow: number;
  calculatedHeight: number;
} {
  const flexGrow = (width * base) / height;
  const calculatedHeight = base;
  return { flexGrow, calculatedHeight };
}
