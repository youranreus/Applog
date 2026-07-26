import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { WeatherService } from '../src/module/weather/weather.service';
import type { IOpenMeteoCurrent } from '../src/module/weather/open-meteo.client';

function attachLogger(service: WeatherService): void {
  Object.assign(service, {
    logger: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  });
}

describe('WeatherService', () => {
  it('非字符串城市按未配置处理，不请求天气服务', async () => {
    let requests = 0;
    const service = new WeatherService(
      {
        getBaseConfigRaw: async () => ({ weatherCity: 123 }),
      } as never,
      {
        getCurrent: async () => {
          requests += 1;
          return null;
        },
      } as never,
    );
    attachLogger(service);

    assert.equal(await service.getCurrentWeather(), null);
    assert.equal(requests, 0);
  });

  it('同城市并发请求合并为一次上游调用', async () => {
    let resolveWeather!: (value: IOpenMeteoCurrent) => void;
    const weatherPromise = new Promise<IOpenMeteoCurrent>((resolve) => {
      resolveWeather = resolve;
    });
    let requests = 0;
    const service = new WeatherService(
      {
        getBaseConfigRaw: async () => ({ weatherCity: '深圳' }),
      } as never,
      {
        getCurrent: async () => {
          requests += 1;
          return weatherPromise;
        },
      } as never,
    );
    attachLogger(service);

    const first = service.getCurrentWeather();
    const second = service.getCurrentWeather();
    resolveWeather({ city: '深圳', temperatureC: 23.46, weatherCode: 2 });

    const expected = { city: '深圳', temperatureC: 23.5, weather: '多云' };
    assert.deepEqual(await first, expected);
    assert.deepEqual(await second, expected);
    assert.equal(requests, 1);
  });

  it('意外上游异常软降级并进入失败缓存', async () => {
    let requests = 0;
    const service = new WeatherService(
      {
        getBaseConfigRaw: async () => ({ weatherCity: '深圳' }),
      } as never,
      {
        getCurrent: async () => {
          requests += 1;
          throw new Error('network down');
        },
      } as never,
    );
    attachLogger(service);

    assert.equal(await service.getCurrentWeather(), null);
    assert.equal(await service.getCurrentWeather(), null);
    assert.equal(requests, 1);
  });
});
