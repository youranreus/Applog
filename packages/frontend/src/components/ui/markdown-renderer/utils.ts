/**
 * 将 HTML 中的 img 标签改为懒加载结构
 *
 * 逻辑说明：
 * 1. 正则匹配所有 <img ...> 标签
 * 2. 将 src 属性改为 data-src，避免首屏加载
 * 3. 为 img 添加 class="lazy-image"
 * 4. 用 span.lazy-image-wrapper 包裹，并插入占位文案 span
 *
 * @param html - 原始 HTML 字符串
 * @returns 处理后的 HTML 字符串
 */
export function wrapImagesForLazyLoad(html: string): string {
  return html.replace(/<img(\s[^>]*?)>/gi, (_match, attrs: string) => {
    let newAttrs = attrs
      .replace(/\bsrc\s*=\s*(["'])([^"']*)\1/i, (_: string, quote: string, url: string) => `data-src=${quote}${url}${quote}`)
      .trim();
    if (/\bclass\s*=/i.test(newAttrs)) {
      newAttrs = newAttrs.replace(/\bclass\s*=\s*(["'])([^"']*)\1/i, (_: string, quote: string, existing: string) =>
        `class=${quote}${existing.trim()} lazy-image${quote}`,
      );
    } else {
      newAttrs += ' class="lazy-image"';
    }
    return `<span class="lazy-image-wrapper"><span class="lazy-image-placeholder">图片加载中</span><img ${newAttrs}></span>`;
  });
}
