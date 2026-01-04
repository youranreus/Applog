import type { Root } from 'mdast';
import type { Transformer } from 'unified';
import { visit } from 'unist-util-visit';
import { toHtml } from 'hast-util-to-html';
import { hasBBCodeHandler, getBBCodeHandler } from './bbcode-handler-registry';

/**
 * BBCode 标签正则表达式
 * 匹配格式: [tagName attr="value"]content[/tagName]
 * 不支持嵌套，使用非贪婪匹配
 */
const BBCODE_REGEX = /\[(\w+)([^\]]*)\](.*?)\[\/\1\]/gs;

/**
 * 解析属性字符串
 * 支持格式: key="value" key2="value2"
 * @param attrsString - 属性字符串
 * @returns 属性对象
 *
 * 逻辑说明：
 * 1. 使用正则表达式匹配 key="value" 格式
 * 2. 提取键值对
 * 3. 返回属性对象
 */
function parseAttrs(attrsString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /(\w+)="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(attrsString)) !== null) {
    const [, key, value] = match;
    if (key && value !== undefined) {
      attrs[key] = value;
    }
  }

  return attrs;
}

/**
 * Remark BBCode 插件
 * 在 Markdown AST 阶段处理行内 BBCode 标签，将其转换为 HTML
 *
 * 逻辑说明：
 * 1. 遍历 Markdown AST 中的所有文本节点
 * 2. 使用正则表达式查找文本中的 BBCode 标签
 * 3. 对于匹配的标签：
 *    - 检查是否在注册表中（hasBBCodeHandler）
 *    - 如果已注册：解析属性，调用处理器生成 hast 节点，转换为 HTML
 *    - 如果未注册：保持原样
 * 4. 将处理后的内容替换原文本节点，或拆分为多个节点（文本 + HTML）
 * 5. 返回修改后的 AST
 */
export function remarkBBCode(): Transformer<Root, Root> {
  return (tree: Root) => {
      visit(tree, 'text', (node, index, parent) => {
        if (!parent || index === undefined || typeof node.value !== 'string') {
          return;
        }

        const text = node.value;
        const matches: Array<{
          fullMatch: string;
          tagName: string;
          attrsString: string;
          content: string;
          start: number;
          end: number;
        }> = [];

        // 重置正则表达式的 lastIndex
        BBCODE_REGEX.lastIndex = 0;

        // 查找所有 BBCode 标签
        let match: RegExpExecArray | null;
        while ((match = BBCODE_REGEX.exec(text)) !== null) {
          const [fullMatch, tagName, attrsString, tagContent] = match;
          if (!tagName || match.index === undefined) {
            continue;
          }

          // 只处理已注册的标签
          if (hasBBCodeHandler(tagName)) {
            matches.push({
              fullMatch,
              tagName,
              attrsString: attrsString || '',
              content: tagContent || '',
              start: match.index,
              end: match.index + fullMatch.length,
            });
          }
        }

        // 如果没有匹配到已注册的标签，保持原样
        if (matches.length === 0) {
          return;
        }

        // 将文本节点替换为多个节点（文本片段 + HTML 节点）
        const newNodes: Array<{ type: 'text' | 'html'; value: string }> = [];
        let lastIndex = 0;

        for (const match of matches) {
          // 添加匹配前的文本片段
          if (match.start > lastIndex) {
            const beforeText = text.slice(lastIndex, match.start);
            if (beforeText) {
              newNodes.push({
                type: 'text',
                value: beforeText,
              });
            }
          }

          // 处理 BBCode 标签
          const handler = getBBCodeHandler(match.tagName);
          if (handler) {
            try {
              // 解析属性
              const attrs = parseAttrs(match.attrsString);

              // 调用处理器生成 hast 节点
              const hastNode = handler({
                content: match.content,
                attrs,
                tagName: match.tagName,
              });

              // 将 hast 节点转换为 HTML 字符串
              const html = toHtml(hastNode);

              // 添加 HTML 节点
              newNodes.push({
                type: 'html',
                value: html,
              });
            } catch (error) {
              console.error(
                `处理 BBCode 标签 [${match.tagName}] 时出错:`,
                error,
              );
              // 出错时保留为文本
              newNodes.push({
                type: 'text',
                value: match.fullMatch,
              });
            }
          }

          lastIndex = match.end;
        }

        // 添加剩余的文本片段
        if (lastIndex < text.length) {
          const remainingText = text.slice(lastIndex);
          if (remainingText) {
            newNodes.push({
              type: 'text',
              value: remainingText,
            });
          }
        }

        // 替换原节点
        if (newNodes.length > 0) {
          const replacementNodes = newNodes.map((node) => {
            if (node.type === 'html') {
              return {
                type: 'html' as const,
                value: node.value,
              };
            }
            return {
              type: 'text' as const,
              value: node.value,
            };
          });

          // 替换原节点
          parent.children.splice(index, 1, ...replacementNodes);
        }
      });
  };
}
