import { Module } from '@nestjs/common';
import { SystemConfigModule } from '@/module/system-config/system-config.module';
import { WakaTimeClient } from './wakatime.client';
import { WakaTimeController } from './wakatime.controller';
import { WakaTimeService } from './wakatime.service';

@Module({
  imports: [SystemConfigModule],
  controllers: [WakaTimeController],
  providers: [WakaTimeClient, WakaTimeService],
  exports: [WakaTimeService],
})
export class WakaTimeModule {}
