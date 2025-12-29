import type { Component } from 'vue';

/**
 * BBCode 组件配置
 */
interface IBBCodeComponentConfig {
  /** Vue 组件 */
  component: Component;
}

/**
 * BBCode 组件注册表
 * 存储标签名到组件配置的映射
 */
const bbcodeComponents = new Map<string, IBBCodeComponentConfig>();

/**
 * 注册 BBCode 标签对应的 Vue 组件
 * @param tagName - 标签名称（不区分大小写，统一转为小写）
 * @param component - Vue 组件
 * @throws {Error} 当标签名或组件为空时抛出错误
 *
 * 逻辑说明：
 * 1. 验证标签名和组件是否有效
 * 2. 将标签名转为小写存储
 * 3. 将组件配置注册到 Map 中
 */
export function registerBBCodeComponent(
  tagName: string,
  component: Component,
): void {
  if (!tagName || typeof tagName !== 'string') {
    throw new Error('标签名必须是非空字符串');
  }

  if (!component) {
    throw new Error('组件不能为空');
  }

  const normalizedTagName = tagName.toLowerCase();
  bbcodeComponents.set(normalizedTagName, {
    component,
  });
}

/**
 * 获取 BBCode 标签对应的组件
 * @param tagName - 标签名称（不区分大小写）
 * @returns 组件配置，如果未注册则返回 undefined
 *
 * 逻辑说明：
 * 1. 将标签名转为小写
 * 2. 从注册表中查找对应的组件配置
 * 3. 返回组件配置或 undefined
 */
export function getBBCodeComponent(
  tagName: string,
): IBBCodeComponentConfig | undefined {
  if (!tagName || typeof tagName !== 'string') {
    return undefined;
  }

  const normalizedTagName = tagName.toLowerCase();
  return bbcodeComponents.get(normalizedTagName);
}

/**
 * 检查标签是否已注册组件
 * @param tagName - 标签名称（不区分大小写）
 * @returns 如果已注册返回 true，否则返回 false
 */
export function hasBBCodeComponent(tagName: string): boolean {
  if (!tagName || typeof tagName !== 'string') {
    return false;
  }

  const normalizedTagName = tagName.toLowerCase();
  return bbcodeComponents.has(normalizedTagName);
}

/**
 * 导出类型供外部使用
 */
export type { IBBCodeComponentConfig };
