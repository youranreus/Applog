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

  /**
   * 公开读取 Landing 所需的聚合学习统计。
   * @returns 可公开统计；未配置或首次获取失败时为 null
   */
  @Get('stats')
  getStats(): Promise<IDuolingoLandingStats | null> {
    return this.duolingoService.getLandingStats();
  }

  /**
   * 管理员读取脱敏后的 Duolingo 配置。
   * @param user - 当前管理员
   * @returns JWT 已脱敏的配置
   */
  @Get('config')
  @AuthRoles('admin')
  getConfig(@UserParams() user: UserJwtPayload): Promise<IDuolingoConfig> {
    return this.duolingoService.getConfig(user);
  }

  /**
   * 管理员保存 Duolingo 配置。
   * @param dto - 配置表单
   * @param user - 当前管理员
   * @returns JWT 已脱敏的最新配置
   */
  @Put('config')
  @AuthRoles('admin')
  setConfig(
    @Body() dto: SetDuolingoConfigDto,
    @UserParams() user: UserJwtPayload,
  ): Promise<IDuolingoConfig> {
    return this.duolingoService.setConfig(dto, user);
  }
}
