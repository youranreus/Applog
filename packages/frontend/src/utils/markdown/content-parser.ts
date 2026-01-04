import type { Component } from 'vue';
import { getBBCodeComponent, isPassthroughTag } from './component-registry';

/**
 * 内容片段类型
 */
export interface IContentFragment {
  /** 片段类型：markdown 文本或组件 */
  type: 'markdown' | 'component';
  /** 内容文本（markdown 片段或原始 bbcode，用于调试） */
  content: string;
  /** Vue 组件（仅当 type 为 'component' 时存在） */
  component?: Component;
  /** 组件 props（仅当 type 为 'component' 时存在） */
  props?: Record<string, unknown>;
}

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
 * 解析文章内容为片段数组
 * @param content - 文章原始内容（可能包含 Markdown 和 BBCode）
 * @returns 内容片段数组
 * @throws {Error} 当解析失败时抛出错误
 *
 * 逻辑说明：
 * 1. 使用正则表达式查找所有 BBCode 标签
 * 2. 对于每个匹配的标签：
 *    - 检查是否为放行标签（通过 isPassthroughTag 判断）
 *    - 如果是放行标签，跳过处理，保留在 markdown 文本中
 *    - 如果不是放行标签：
 *      - 提取标签名、属性和内容
 *      - 查找对应的注册组件
 *      - 如果找到组件，生成组件片段（props: { content, ...attrs }）
 *      - 如果未找到，保留为 markdown 文本
 * 3. 将内容拆分为 markdown 文本片段和组件片段
 * 4. 过滤空 markdown 片段
 * 5. 返回片段数组
 */
export function parseContent(content: string): IContentFragment[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const fragments: IContentFragment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // 重置正则表达式的 lastIndex
  BBCODE_REGEX.lastIndex = 0;

  // 查找所有 BBCode 标签
  while ((match = BBCODE_REGEX.exec(content)) !== null) {
    const [fullMatch, tagName, attrsString, tagContent] = match;
    if (!tagName || match.index === undefined) {
      continue;
    }

    const matchStart = match.index;
    const matchEnd = matchStart + fullMatch.length;

    // 检查是否为放行标签
    if (isPassthroughTag(tagName)) {
      // 放行标签不分割，保留在 markdown 文本中
      // 不更新 lastIndex，让标签包含在后续的 markdown 文本片段中
      continue;
    }

    // 添加匹配前的 markdown 文本片段
    if (matchStart > lastIndex) {
      const beforeText = content.slice(lastIndex, matchStart);
      if (beforeText.trim()) {
        fragments.push({
          type: 'markdown',
          content: beforeText,
        });
      }
    }

    // 处理 BBCode 标签
    const componentConfig = getBBCodeComponent(tagName);
    if (componentConfig) {
      try {
        // 解析属性
        const attrs = parseAttrs(attrsString || '');

        // 生成组件 props：content 作为默认 prop，attrs 展开
        const props: Record<string, unknown> = {
          content: tagContent || '',
          ...attrs,
        };

        fragments.push({
          type: 'component',
          content: fullMatch, // 保留原始 bbcode 用于调试
          component: componentConfig.component,
          props,
        });
      } catch (error) {
        console.error(`处理 BBCode 标签 [${tagName}] 时出错:`, error);
        // 出错时保留为 markdown 文本
        fragments.push({
          type: 'markdown',
          content: fullMatch,
        });
      }
    } else {
      // 未注册的标签保留为 markdown 文本
      fragments.push({
        type: 'markdown',
        content: fullMatch,
      });
    }

    lastIndex = matchEnd;
  }

  // 添加剩余的 markdown 文本片段
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex);
    if (remainingText.trim()) {
      fragments.push({
        type: 'markdown',
        content: remainingText,
      });
    }
  }

  // 如果没有匹配到任何标签，返回整个内容作为 markdown 片段
  if (fragments.length === 0 && content.trim()) {
    fragments.push({
      type: 'markdown',
      content,
    });
  }

  return fragments;
}
