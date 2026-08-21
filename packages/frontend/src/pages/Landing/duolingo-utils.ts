import type { IDuolingoYearDay } from '@applog/common';

export interface IHeatmapCell extends IDuolingoYearDay {
  intensity: 0 | 1 | 2 | 3 | 4;
  label: string;
}

interface IHorizontalScrollContainer {
  clientWidth: number;
  scrollWidth: number;
}

interface IHorizontalScrollTarget {
  offsetLeft: number;
  offsetWidth: number;
}

/** 格式化整数 XP。 */
export function formatXp(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

/** 格式化可靠学习时长；null 明确表示未知。 */
export function formatLearningTime(seconds: number | null): string {
  if (seconds === null) return '暂无可靠数据';
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`;
}

function quantile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  return (
    sorted[
      Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil(sorted.length * ratio) - 1),
      )
    ] ?? 0
  );
}

/** 按当年非零 XP 分位数映射四档强度。 */
export function buildHeatmapCells(days: IDuolingoYearDay[]): IHeatmapCell[] {
  const positive = days
    .flatMap((day) => (day.xp && day.xp > 0 ? [day.xp] : []))
    .sort((a, b) => a - b);
  const thresholds = [
    quantile(positive, 0.25),
    quantile(positive, 0.5),
    quantile(positive, 0.75),
  ];
  const [low = 0, medium = 0, high = 0] = thresholds;
  const locale = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return days.map((day) => {
    let intensity: IHeatmapCell['intensity'] = 0;
    if (!day.future && day.xp && day.xp > 0) {
      intensity =
        day.xp <= low
          ? 1
          : day.xp <= medium
            ? 2
            : day.xp <= high
              ? 3
              : 4;
    }
    const dateText = locale.format(new Date(`${day.date}T00:00:00Z`));
    const state = day.future
      ? '未来日期'
      : day.xp === 0
        ? '0 XP'
        : `${formatXp(day.xp ?? 0)} XP`;
    return { ...day, intensity, label: `${dateText}，${state}` };
  });
}

/** 用空占位将 1 月 1 日对齐到星期行；周日为第一行。 */
export function getHeatmapLeadingBlanks(firstDate: string): number[] {
  const weekday = new Date(`${firstDate}T00:00:00Z`).getUTCDay();
  return Array.from({ length: weekday }, (_, index) => index);
}

/**
 * 计算将目标右边缘滚入容器时的横向位置，不影响页面纵向滚动。
 */
export function getHorizontalScrollLeft(
  container: IHorizontalScrollContainer,
  target: IHorizontalScrollTarget,
): number {
  const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
  const targetRight = target.offsetLeft + target.offsetWidth;
  return Math.min(maxScrollLeft, Math.max(0, targetRight - container.clientWidth));
}
