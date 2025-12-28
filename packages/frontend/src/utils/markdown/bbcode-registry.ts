import type { Element } from 'hast';

/**
 * BBCode 标签属性类型
 */
type IBBCodeAttrs = Record<string, string>;

/**
 * BBCode 处理器函数类型
 * @param attrs - 标签属性对象
 * @param content - 标签内容（已解析的 markdown 内容）
 * @returns 返回 unified AST 节点（hast Element）
 */
type IBBCodeHandler = (attrs: IBBCodeAttrs, content: string) => Element;

/**
 * BBCode 处理器注册表
 * 存储标签名到处理器的映射
 */
const bbcodeHandlers = new Map<string, IBBCodeHandler>();

/**
 * 注册 BBCode 标签处理器
 * @param tagName - 标签名称（不区分大小写，统一转为小写）
 * @param handler - 处理器函数
 * @throws {Error} 当标签名或处理器为空时抛出错误
 *
 * 逻辑说明：
 * 1. 验证标签名和处理器是否有效
 * 2. 将标签名转为小写存储
 * 3. 将处理器注册到 Map 中
 */
export function registerBBCodeHandler(tagName: string, handler: IBBCodeHandler): void {
  if (!tagName || typeof tagName !== 'string') {
    throw new Error('标签名必须是非空字符串');
  }

  if (typeof handler !== 'function') {
    throw new Error('处理器必须是一个函数');
  }

  const normalizedTagName = tagName.toLowerCase();
  bbcodeHandlers.set(normalizedTagName, handler);
}

/**
 * 获取 BBCode 标签处理器
 * @param tagName - 标签名称（不区分大小写）
 * @returns 处理器函数，如果未注册则返回 undefined
 *
 * 逻辑说明：
 * 1. 将标签名转为小写
 * 2. 从注册表中查找对应的处理器
 * 3. 返回处理器或 undefined
 */
export function getBBCodeHandler(tagName: string): IBBCodeHandler | undefined {
  if (!tagName || typeof tagName !== 'string') {
    return undefined;
  }

  const normalizedTagName = tagName.toLowerCase();
  return bbcodeHandlers.get(normalizedTagName);
}

/**
 * 检查标签是否已注册
 * @param tagName - 标签名称（不区分大小写）
 * @returns 如果已注册返回 true，否则返回 false
 */
export function hasBBCodeHandler(tagName: string): boolean {
  if (!tagName || typeof tagName !== 'string') {
    return false;
  }

  const normalizedTagName = tagName.toLowerCase();
  return bbcodeHandlers.has(normalizedTagName);
}

/**
 * 导出类型供外部使用
 */
export type { IBBCodeHandler, IBBCodeAttrs };
