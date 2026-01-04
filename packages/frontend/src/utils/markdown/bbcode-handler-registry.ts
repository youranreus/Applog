import type { Element } from 'hast';

/**
 * BBCode 处理器回调函数参数
 */
export interface IBBCodeHandlerParams {
  /** 标签内容 */
  content: string;
  /** 标签属性 */
  attrs: Record<string, string>;
  /** 标签名称 */
  tagName: string;
}

/**
 * BBCode 处理器回调函数类型
 * @param params - 处理器参数
 * @returns hast Element 节点
 */
export type IBBCodeHandler = (params: IBBCodeHandlerParams) => Element;

/**
 * BBCode 处理器注册表
 * 存储标签名到处理器函数的映射
 */
const bbcodeHandlers = new Map<string, IBBCodeHandler>();

/**
 * 注册 BBCode 标签对应的处理器函数
 * @param tagName - 标签名称（不区分大小写，统一转为小写）
 * @param handler - 处理器回调函数，返回 hast Element 节点
 * @throws {Error} 当标签名或处理器为空时抛出错误
 *
 * 逻辑说明：
 * 1. 验证标签名和处理器是否有效
 * 2. 将标签名转为小写存储
 * 3. 将处理器函数注册到 Map 中
 */
export function registerBBCodeHandler(
  tagName: string,
  handler: IBBCodeHandler,
): void {
  if (!tagName || typeof tagName !== 'string') {
    throw new Error('标签名必须是非空字符串');
  }

  if (!handler || typeof handler !== 'function') {
    throw new Error('处理器必须是一个函数');
  }

  const normalizedTagName = tagName.toLowerCase();
  bbcodeHandlers.set(normalizedTagName, handler);
}

/**
 * 获取 BBCode 标签对应的处理器
 * @param tagName - 标签名称（不区分大小写）
 * @returns 处理器函数，如果未注册则返回 undefined
 *
 * 逻辑说明：
 * 1. 将标签名转为小写
 * 2. 从注册表中查找对应的处理器函数
 * 3. 返回处理器函数或 undefined
 */
export function getBBCodeHandler(
  tagName: string,
): IBBCodeHandler | undefined {
  if (!tagName || typeof tagName !== 'string') {
    return undefined;
  }

  const normalizedTagName = tagName.toLowerCase();
  return bbcodeHandlers.get(normalizedTagName);
}

/**
 * 检查标签是否已注册处理器
 * @param tagName - 标签名称（不区分大小写）
 * @returns 如果已注册返回 true，否则返回 false
 *
 * 逻辑说明：
 * 1. 将标签名转为小写
 * 2. 检查是否在注册表中
 * 3. 返回检查结果
 */
export function hasBBCodeHandler(tagName: string): boolean {
  if (!tagName || typeof tagName !== 'string') {
    return false;
  }

  const normalizedTagName = tagName.toLowerCase();
  return bbcodeHandlers.has(normalizedTagName);
}
