import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import type { IGarminLandingStats } from '@applog/common';
import { GarminService } from './garmin.service';

@Controller({ path: 'garmin', version: [VERSION_NEUTRAL, '1'] })
export class GarminController {
  constructor(private readonly garminService: GarminService) {}

  /** 返回公开 Landing 使用的 Garmin 快照。 */
  @Get('stats')
  getStats(): Promise<IGarminLandingStats | null> {
    return this.garminService.getLandingStats();
  }
}
