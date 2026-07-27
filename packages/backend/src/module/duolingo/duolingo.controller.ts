import { Body, Controller, Get, Put, VERSION_NEUTRAL } from '@nestjs/common';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import type { IDuolingoConfig, IDuolingoLandingStats } from '@applog/common';
import { DuolingoService } from './duolingo.service';
import { SetDuolingoConfigDto } from './dto';

@Controller({
  path: 'duolingo',
  version: [VERSION_NEUTRAL, '1'],
})
export class DuolingoController {
  constructor(private readonly duolingoService: DuolingoService) {}

  @Get('stats')
  getStats(): Promise<IDuolingoLandingStats | null> {
    return this.duolingoService.getLandingStats();
  }

  @Get('config')
  @AuthRoles('admin')
  getConfig(@UserParams() user: UserJwtPayload): Promise<IDuolingoConfig> {
    return this.duolingoService.getConfig(user);
  }

  @Put('config')
  @AuthRoles('admin')
  setConfig(
    @Body() dto: SetDuolingoConfigDto,
    @UserParams() user: UserJwtPayload,
  ): Promise<IDuolingoConfig> {
    return this.duolingoService.setConfig(dto, user);
  }
}
