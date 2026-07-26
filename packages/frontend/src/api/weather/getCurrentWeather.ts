import { alovaInstance } from '@/utils/alova';
import type { ICurrentWeatherDto } from '@/types/weather';

/**
 * 获取后台配置城市的当前天气。
 * @returns Method；未配置或服务不可用时返回 null
 */
export const getCurrentWeather = () => {
  return alovaInstance.Get<ICurrentWeatherDto | null>('/weather/current');
};
