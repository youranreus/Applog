/**
 * localStorage 中访客 ID 的 key
 */
export const VISITOR_ID_STORAGE_KEY = 'applog_vid';

/**
 * 生成 UUID v4（优先 crypto.randomUUID）
 * @returns UUID 字符串
 */
function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // 降级：简易 UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 校验字符串是否为 UUID v4 形态
 * @param value - 待校验值
 * @returns 是否合法
 */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * 读取或生成长期访客 ID（写入 localStorage `applog_vid`）
 * SSR / 无 window 时返回临时 UUID（不上报持久化）
 * @returns 访客 UUID
 *
 * 逻辑说明：
 * 1. 尝试读取已有 applog_vid
 * 2. 合法则复用；否则生成并写入
 */
export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createUuid();
  }

  try {
    const existing = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (existing && isUuid(existing)) {
      return existing;
    }

    const next = createUuid();
    window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return createUuid();
  }
}
