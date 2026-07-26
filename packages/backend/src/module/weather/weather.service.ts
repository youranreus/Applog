import { Inject, Injectable } from '@nestjs/common';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import { SystemConfigService } from '@/module/system-config/system-config.service';
import type { ICurrentWeatherDto } from './dto';
import { OpenMeteoClient, type IOpenMeteoCurrent } from './open-meteo.client';
import { formatWeatherCode, normalizeTemperatureC } from './weather.utils';

const WEATHER_SUCCESS_CACHE_TTL_MS = 10 * 60 * 1000;
const WEATHER_FAILURE_CACHE_TTL_MS = 60_000;

interface IWeatherCacheEntry {
  expiresAt: number;
  value: ICurrentWeatherDto | null;
}

@Injectable()
export class WeatherService {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  private readonly cache = new Map<string, IWeatherCacheEntry>();
  private readonly inFlight = new Map<
    string,
    Promise<ICurrentWeatherDto | null>
  >();

  constructor(
    private readonly systemConfigService: SystemConfigService,
    private readonly openMeteoClient: OpenMeteoClient,
  ) {}

  private log(message: string): void {
    this.logger.log(message, WeatherService.name);
  }

  private warn(message: string): void {
    this.logger.warn(message, WeatherService.name);
  }

  private error(message: string): void {
    this.logger.error(message, WeatherService.name);
  }

  /**
   * 根据系统配置城市获取当前天气。
   * @returns 当前天气；未配置或第三方服务不可用时返回 null
   */
  async getCurrentWeather(): Promise<ICurrentWeatherDto | null> {
    const config = await this.systemConfigService.getBaseConfigRaw();
    const city =
      typeof config?.weatherCity === 'string' ? config.weatherCity.trim() : '';
    if (!city) {
      return null;
    }

    const cacheKey = city.toLocaleLowerCase('zh-CN');
    const cached = this.cache.get(cacheKey);
    if (cached?.expiresAt && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      return pending;
    }

    const request = this.loadCurrentWeather(city, cacheKey);
    this.inFlight.set(cacheKey, request);
    try {
      return await request;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  /**
   * 请求并写入成功或失败缓存。
   * @param city - 配置城市
   * @param cacheKey - 标准化缓存 key
   * @returns 当前天气或 null
   */
  private async loadCurrentWeather(
    city: string,
    cacheKey: string,
  ): Promise<ICurrentWeatherDto | null> {
    let raw: IOpenMeteoCurrent | null;
    try {
      raw = await this.openMeteoClient.getCurrent(city);
    } catch (error) {
      this.error(`查询城市天气失败: ${(error as Error).message}`);
      this.cache.set(cacheKey, {
        expiresAt: Date.now() + WEATHER_FAILURE_CACHE_TTL_MS,
        value: null,
      });
      return null;
    }
    const temperatureC = normalizeTemperatureC(raw?.temperatureC);
    const weatherCode = raw?.weatherCode;
    const weather =
      typeof weatherCode === 'number' && Number.isFinite(weatherCode)
        ? formatWeatherCode(weatherCode)
        : null;

    if (!raw || temperatureC === null || !weather) {
      this.warn(`城市天气响应不可用: city=${city}`);
      this.cache.set(cacheKey, {
        expiresAt: Date.now() + WEATHER_FAILURE_CACHE_TTL_MS,
        value: null,
      });
      return null;
    }

    const value: ICurrentWeatherDto = {
      city: raw.city,
      weather,
      temperatureC,
    };
    this.cache.set(cacheKey, {
      expiresAt: Date.now() + WEATHER_SUCCESS_CACHE_TTL_MS,
      value,
    });
    this.log(`城市天气缓存已更新: city=${value.city}`);
    return value;
  }
}
