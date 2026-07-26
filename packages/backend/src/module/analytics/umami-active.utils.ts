/**
 * Umami active visitors 可能返回的对象形态。
 */
interface IUmamiActiveObject {
  x?: unknown;
  value?: unknown;
  visitors?: unknown;
  totals?: {
    visitors?: unknown;
  };
}

/**
 * 将 Umami active visitors 的常见返回形态规范化为非负整数。
 * @param raw - Umami 原始响应
 * @returns 有效在线人数；无法识别时返回 null
 */
export function normalizeUmamiActiveVisitors(raw: unknown): number | null {
  let candidate: unknown = raw;

  if (raw && typeof raw === 'object') {
    const object = raw as IUmamiActiveObject;
    candidate =
      object.x ?? object.value ?? object.visitors ?? object.totals?.visitors;
  }

  if (
    typeof candidate !== 'number' ||
    !Number.isFinite(candidate) ||
    candidate < 0
  ) {
    return null;
  }

  return Math.floor(candidate);
}
