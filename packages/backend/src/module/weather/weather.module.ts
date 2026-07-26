import { Module } from '@nestjs/common';
import { SystemConfigModule } from '@/module/system-config/system-config.module';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { OpenMeteoClient } from './open-meteo.client';

@Module({
  imports: [SystemConfigModule],
  controllers: [WeatherController],
  providers: [WeatherService, OpenMeteoClient],
})
export class WeatherModule {}
