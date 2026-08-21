import { Body, Controller, Get, Put, VERSION_NEUTRAL } from '@nestjs/common';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import type { IWakaTimeConfig, IWakaTimeLandingStats } from '@applog/common';
import { SetWakaTimeConfigDto } from './dto';
import { WakaTimeService } from './wakatime.service';

@Controller({ path: 'wakatime', version: [VERSION_NEUTRAL, '1'] })
export class WakaTimeController {
  constructor(private readonly wakaTimeService: WakaTimeService) {}

  @Get('stats')
  getStats(): IWakaTimeLandingStats | null {
    return this.wakaTimeService.getLandingStats();
  }

  @Get('config')
  @AuthRoles('admin')
  getConfig(@UserParams() user: UserJwtPayload): Promise<IWakaTimeConfig> {
    return this.wakaTimeService.getConfig(user);
  }

  @Put('config')
  @AuthRoles('admin')
  setConfig(
    @Body() dto: SetWakaTimeConfigDto,
    @UserParams() user: UserJwtPayload,
  ): Promise<IWakaTimeConfig> {
    return this.wakaTimeService.setConfig(dto, user);
  }
}
