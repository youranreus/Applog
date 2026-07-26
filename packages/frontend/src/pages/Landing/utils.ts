import type { ILandingLink } from './types';

interface INormalizeLandingLinkOptions {
  fallback?: string;
  allowInternal?: boolean;
}

/**
 * 解析可选 Landing 文案：字段缺失使用默认值，显式空串隐藏。
 * @param value - 后台配置值
 * @param fallback - 旧配置缺字段时的默认值
 * @returns 可展示文本或 null
 */
export function resolveLandingText(
  value: string | undefined,
  fallback: string,
): string | null {
  const source = value === undefined ? fallback : value;
  return source.trim() || null;
}

/**
 * 规范化 Landing 链接并过滤危险协议。
 * @param value - 后台配置值
 * @param options - 缺省值与站内路径开关
 * @returns 安全链接；显式空串或非法协议返回 null
 */
export function normalizeLandingLink(
  value: string | undefined,
  options: INormalizeLandingLinkOptions = {},
): ILandingLink | null {
  const source = value === undefined ? (options.fallback ?? '') : value;
  const trimmed = source.trim();
  if (!trimmed) {
    return null;
  }

  if (
    options.allowInternal &&
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//')
  ) {
    return { href: trimmed, external: false };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return { href: url.toString(), external: true };
  } catch {
    return null;
  }
}
