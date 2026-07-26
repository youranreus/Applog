/**
 * 后台配置城市的公开当前天气。
 */
export interface ICurrentWeatherDto {
  city: string;
  weather: string;
  temperatureC: number;
}
