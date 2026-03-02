/**
 * 对字符串进行 HTML 实体转义，避免作为 HTML 内容注入时产生 XSS
 * @param raw - 原始字符串
 * @returns 转义后的字符串
 */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 将 HTML 中的 img 标签改为懒加载结构
 *
 * 逻辑说明：
 * 1. 正则匹配所有 <img ...> 标签
 * 2. 将 src 属性改为 data-src，避免首屏加载
 * 3. 为 img 添加 class="lazy-image"
 * 4. 用 span.lazy-image-wrapper 包裹，并插入占位文案 span
 * 5. 非 .bq 图片若有 alt，在图片后追加 span.image-caption（初始隐藏，懒加载完成后显示）
 * 6. .bq、.friend-avatar 等装饰/小图不参与懒加载包裹，保持原样
 *
 * @param html - 原始 HTML 字符串
 * @returns 处理后的 HTML 字符串
 */
export function wrapImagesForLazyLoad(html: string): string {
  return html.replace(/<img(\s[^>]*?)>/gi, (match, attrs: string) => {
    const classMatch = attrs.match(/\bclass\s*=\s*(["'])([^"']*)\1/i);
    const imgClass = classMatch?.[2]?.trim() ?? '';
    const hasBq = /\bbq\b/.test(imgClass);
    const hasFriendAvatar = /\bfriend-avatar\b/.test(imgClass);
    if (hasFriendAvatar) return match;

    const altMatch = attrs.match(/\balt\s*=\s*(["'])([^"']*)\1/i);
    const alt = altMatch?.[2] ? altMatch[2] : '';
    const showCaption = !hasBq && alt.length > 0;
    const captionHtml = showCaption
      ? `<span class="image-caption" style="display:none">${escapeHtml(alt)}</span>`
      : '';

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
    return `
    <span class="lazy-image-wrapper">
      <span class="lazy-image-placeholder">图片加载中</span>
      <img ${newAttrs}>
      ${captionHtml}
    </span>`;
  });
}
