import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { WeatherService } from './weather.service';
import type { ICurrentWeatherDto } from './dto';

@Controller({
  path: 'weather',
  version: [VERSION_NEUTRAL, '1'],
})
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  /**
   * 公开读取后台配置城市的当前天气。
   * @returns 当前天气；不可用时为 null
   */
  @Get('current')
  async getCurrentWeather(): Promise<ICurrentWeatherDto | null> {
    return this.weatherService.getCurrentWeather();
  }
}
