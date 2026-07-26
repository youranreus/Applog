import { Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_HTTP_TIMEOUT_MS = 6_000;

interface IGeocodingResponse {
  results?: Array<{
    name?: string;
    latitude?: number;
    longitude?: number;
  }>;
}

interface IForecastResponse {
  current?: {
    temperature_2m?: unknown;
    weather_code?: unknown;
  };
}

export interface IOpenMeteoCurrent {
  city: string;
  temperatureC: unknown;
  weatherCode: unknown;
}

@Injectable()
export class OpenMeteoClient {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  private log(message: string): void {
    this.logger.log(message, OpenMeteoClient.name);
  }

  private warn(message: string): void {
    this.logger.warn(message, OpenMeteoClient.name);
  }

  private error(message: string): void {
    this.logger.error(message, OpenMeteoClient.name);
  }

  /**
   * 解析城市并读取当前天气原始数据。
   * @param city - 后台配置城市
   * @returns 当前天气原始数据；城市无法解析或请求失败时返回 null
   */
  async getCurrent(city: string): Promise<IOpenMeteoCurrent | null> {
    try {
      const geocoding = await axios.get<IGeocodingResponse>(GEOCODING_URL, {
        params: { name: city, count: 1, language: 'zh', format: 'json' },
        timeout: WEATHER_HTTP_TIMEOUT_MS,
      });
      const location = geocoding.data.results?.[0];
      if (
        !location ||
        typeof location.latitude !== 'number' ||
        !Number.isFinite(location.latitude) ||
        typeof location.longitude !== 'number' ||
        !Number.isFinite(location.longitude)
      ) {
        this.warn(`Open-Meteo 无法解析城市: city=${city}`);
        return null;
      }

      const forecast = await axios.get<IForecastResponse>(FORECAST_URL, {
        params: {
          latitude: location.latitude,
          longitude: location.longitude,
          current: 'temperature_2m,weather_code',
          timezone: 'auto',
        },
        timeout: WEATHER_HTTP_TIMEOUT_MS,
      });
      const current = {
        city: location.name?.trim() || city,
        temperatureC: forecast.data.current?.temperature_2m,
        weatherCode: forecast.data.current?.weather_code,
      };
      this.log(`Open-Meteo 天气请求成功: city=${current.city}`);
      return current;
    } catch (error) {
      this.error(`Open-Meteo 请求失败: ${(error as Error).message}`);
      return null;
    }
  }
}
