import type { Processor } from 'unified';
import type { Element, ElementContent } from 'hast';
import { toHtml } from 'hast-util-to-html';
import { hasBBCodeHandler, getBBCodeHandler } from './bbcode-handler-registry';

/**
 * BBCode 标签正则（原始 markdown，内容可跨行）
 * 匹配格式: [tagName attr="value"]content[/tagName]，content 用 [\s\S]*? 支持换行
 */
const BBCODE_RAW_REGEX = /\[(\w+)([^\]]*)\]([\s\S]*?)\[\/\1\]/g;

/**
 * 解析 BBCode 属性字符串
 * 支持格式: key="value" key2="value2"
 * @param attrsString - 属性字符串
 * @returns 属性对象
 */
export function parseBBCodeAttrs(attrsString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /(\w+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrsString)) !== null) {
    const [, key, value] = match;
    if (key && value !== undefined) attrs[key] = value;
  }
  return attrs;
}

/**
 * 将 hast 中带换行的文本节点展开为 text + br + text，保证多行内容在 HTML 中保留换行
 * @param node - hast 节点（element 或 text）
 * @returns 展开后的节点或节点数组（text 含 \n 时返回数组）
 */
function expandNewlinesInHast(
  node: ElementContent,
): ElementContent | ElementContent[] {
  if (node.type === 'text') {
    if (!node.value.includes('\n')) return node;
    const parts = node.value.split('\n');
    return parts.flatMap((p, i) =>
      i === 0
        ? [{ type: 'text' as const, value: p }]
        : [
            {
              type: 'element' as const,
              tagName: 'br',
              properties: {},
              children: [],
            },
            { type: 'text' as const, value: p },
          ],
    );
  }
  if (node.type === 'element') {
    const newChildren = node.children.flatMap((child) => {
      const r = expandNewlinesInHast(child);
      return Array.isArray(r) ? r : [r];
    });
    return { ...node, children: newChildren };
  }
  return node;
}

/**
 * 在原始 markdown 中替换所有 BBCode 为对应 HTML（支持跨行，内容中换行转为 <br>）
 * 仅在此处处理 BBCode，保证单一逻辑路径
 * @param markdown - 原始 markdown 字符串
 * @returns 替换后的字符串
 */
function replaceBBCodeInRawMarkdown(markdown: string): string {
  return markdown.replace(
    BBCODE_RAW_REGEX,
    (fullMatch, tagName: string, attrsString: string, content: string) => {
      if (!tagName || !hasBBCodeHandler(tagName)) return fullMatch;
      const handler = getBBCodeHandler(tagName);
      if (!handler) return fullMatch;
      try {
        const attrs = parseBBCodeAttrs(attrsString ?? '');
        let hastNode = handler({
          content: content ?? '',
          attrs,
          tagName,
        });
        hastNode = expandNewlinesInHast(hastNode as ElementContent) as Element;
        return toHtml(hastNode);
      } catch (error) {
        console.error(`处理 BBCode 标签 [${tagName}] 时出错:`, error);
        return fullMatch;
      }
    },
  );
}

/**
 * Remark BBCode 插件（唯一逻辑路径）
 * 包装 parser：在 remark-parse 解析原始字符串前，将 BBCode 替换为 HTML（多行支持，换行保留为 <br>）
 * 用法：.use(remarkParse).use(remarkBBCode) —— 直接传函数引用，不要调用
 *
 * 逻辑说明：
 * 1. unified 以 attacher.call(processor) 调用本函数，this 即为 processor
 * 2. 取出当前 parser（由 remarkParse 设置），用新函数包装：先替换 BBCode 再调原 parser
 * 3. 不返回 transformer，仅修改 parser
 */
export function remarkBBCode(this: Processor): void {
  const parse = this.parser;
  if (!parse) {
    throw new Error('remarkBBCode 必须放在 remark-parse 之后使用');
  }
  type ParseFile = Parameters<typeof parse>[1];
  this.parser = (doc: string, file: ParseFile) => {
    const replaced = replaceBBCodeInRawMarkdown(doc);
    return parse(replaced, file);
  };
}
