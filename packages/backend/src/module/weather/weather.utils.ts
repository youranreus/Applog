/**
 * 将 WMO weather code 映射为首页使用的简短中文天气。
 * @param code - WMO 天气代码
 * @returns 天气描述
 */
export function formatWeatherCode(code: number): string | null {
  if (code === 0) return '晴';
  if (code === 1) return '晴间多云';
  if (code === 2) return '多云';
  if (code === 3) return '阴';
  if (code === 45 || code === 48) return '雾';
  if (code === 51 || code === 53 || code === 55) return '毛毛雨';
  if (code === 56 || code === 57) return '冻雨';
  if (code === 61) return '小雨';
  if (code === 63) return '中雨';
  if (code === 65) return '大雨';
  if (code === 66 || code === 67) return '冻雨';
  if (code === 71) return '小雪';
  if (code === 73) return '中雪';
  if (code === 75 || code === 77) return '大雪';
  if (code === 80) return '阵雨';
  if (code === 81) return '中阵雨';
  if (code === 82) return '强阵雨';
  if (code === 85 || code === 86) return '阵雪';
  if (code === 95 || code === 96 || code === 99) return '雷雨';
  return null;
}

/**
 * 将第三方温度值规范化为一位小数的摄氏温度。
 * @param value - 原始温度
 * @returns 有效温度；非法值返回 null
 */
export function normalizeTemperatureC(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 10) / 10;
}
