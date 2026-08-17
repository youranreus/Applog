import { Body, Controller, Get, Put, VERSION_NEUTRAL } from '@nestjs/common';
import type { INotificationConfig } from '@applog/common';
import type { UserJwtPayload } from '@reus-able/types';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import { SystemConfigService } from '@/module/system-config/system-config.service';
import { SetNotificationConfigDto } from './dto';

@Controller({
  path: 'notification',
  version: [VERSION_NEUTRAL, '1'],
})
export class NotificationController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get('config')
  @AuthRoles('admin')
  getConfig(@UserParams() user: UserJwtPayload): Promise<INotificationConfig> {
    return this.systemConfigService.getNotificationConfigMasked(user);
  }

  @Put('config')
  @AuthRoles('admin')
  setConfig(
    @Body() dto: SetNotificationConfigDto,
    @UserParams() user: UserJwtPayload,
  ): Promise<INotificationConfig> {
    return this.systemConfigService.setNotificationConfig(dto, user);
  }
}
