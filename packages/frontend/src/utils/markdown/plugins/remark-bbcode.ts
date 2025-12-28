import { visit } from 'unist-util-visit';
import type { Root, Text, Element, Content } from 'hast';
import type { Plugin } from 'unified';
import { getBBCodeHandler } from '../bbcode-registry';

/**
 * BBCode 标签正则表达式
 * 匹配格式: [tagName attr="value"][/tagName]
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
 * 处理文本节点中的 BBCode 标签
 * @param text - 文本内容
 * @returns 处理后的节点数组（可能是文本节点或元素节点）
 *
 * 逻辑说明：
 * 1. 使用正则表达式查找所有 BBCode 标签
 * 2. 对于每个匹配的标签：
 *    - 提取标签名、属性和内容
 *    - 查找对应的处理器
 *    - 如果找到处理器，调用它并替换为返回的节点
 *    - 如果未找到，保留原始文本
 * 3. 返回处理后的节点数组
 */
function processBBCodeInText(text: string): Content[] {
  const nodes: Content[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // 重置正则表达式的 lastIndex
  BBCODE_REGEX.lastIndex = 0;

  while ((match = BBCODE_REGEX.exec(text)) !== null) {
    const [fullMatch, tagName, attrsString, content] = match;
    if (!tagName || match.index === undefined) {
      continue;
    }
    const matchStart = match.index;
    const matchEnd = matchStart + fullMatch.length;

      // 添加匹配前的文本
      if (matchStart > lastIndex) {
        const beforeText = text.slice(lastIndex, matchStart);
        if (beforeText) {
          const textNode: Text = { type: 'text', value: beforeText };
          nodes.push(textNode);
        }
      }

    // 处理 BBCode 标签
    const handler = getBBCodeHandler(tagName);
    if (handler) {
      try {
        const attrs = parseAttrs(attrsString || '');
        const element = handler(attrs, content || '');
        // 确保返回的是有效的 hast Element
        if (element && typeof element === 'object' && element.type === 'element') {
          nodes.push(element);
        } else {
          // 如果处理器返回的不是有效元素，保留原始文本
          const textNode: Text = { type: 'text', value: fullMatch };
          nodes.push(textNode);
        }
      } catch (error) {
        console.error(`处理 BBCode 标签 [${tagName}] 时出错:`, error);
        // 出错时保留原始文本
        const textNode: Text = { type: 'text', value: fullMatch };
        nodes.push(textNode);
      }
    } else {
      // 未注册的标签保留原始文本
      const textNode: Text = { type: 'text', value: fullMatch };
      nodes.push(textNode);
    }

    lastIndex = matchEnd;
  }

  // 添加剩余的文本
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (remainingText) {
      const textNode: Text = { type: 'text', value: remainingText };
      nodes.push(textNode);
    }
  }

  // 如果没有匹配到任何标签，返回原始文本节点
  if (nodes.length === 0) {
    const textNode: Text = { type: 'text', value: text };
    nodes.push(textNode);
  }

  return nodes;
}

/**
 * Unified rehype 插件：处理 BBCode 自定义标签
 * 在 HTML AST 阶段处理文本节点中的 BBCode 标签
 *
 * 逻辑说明：
 * 1. 遍历所有文本节点
 * 2. 检查文本中是否包含 BBCode 标签
 * 3. 如果包含，处理标签并替换文本节点
 * 4. 支持将单个文本节点替换为多个节点（文本节点或元素节点）
 */
export const rehypeBBCode: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || typeof index !== 'number' || !node.value) {
        return;
      }

      const text = node.value;
      // 检查是否包含 BBCode 标签
      if (!BBCODE_REGEX.test(text)) {
        return;
      }

      // 重置正则表达式
      BBCODE_REGEX.lastIndex = 0;

      // 处理文本中的 BBCode 标签
      const processedNodes = processBBCodeInText(text);

      // 如果处理后的节点数量为 1 且类型相同，直接替换
      const firstNode = processedNodes[0];
      if (processedNodes.length === 1 && firstNode && firstNode.type === 'text') {
        const textNode = firstNode;
        if ('value' in textNode && typeof textNode.value === 'string') {
          node.value = textNode.value;
        }
        return;
      }

      // 如果处理后有多个节点或包含元素节点，需要替换父节点中的子节点
      const parentChildren = parent.children;
      if (Array.isArray(parentChildren)) {
        // 移除原文本节点，插入处理后的节点
        parentChildren.splice(index, 1, ...processedNodes);
      }
    });
  };
};
