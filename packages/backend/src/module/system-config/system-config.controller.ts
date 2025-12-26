import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import { SystemConfigService } from './system-config.service';
import { MigrationService } from './migration.service';
import { BatchConfigDto, SetConfigDto, MigrateDataDto } from './dto';
import type {
  ConfigBatchRecord,
  IConfigResponseDto,
  IInitResponseDto,
  IMigrationResultDto,
} from './dto';

@Controller({
  path: 'config',
  version: [VERSION_NEUTRAL, '1'],
})
export class SystemConfigController {
  constructor(
    private readonly systemConfigService: SystemConfigService,
    private readonly migrationService: MigrationService,
  ) {}

  /**
   * 读取单个配置项
   * - 普通配置：公开访问
   * - SYSTEM_ 配置：需要管理员（内部校验）
   * @param key 配置 key
   * @param user 可选的当前用户
   * @returns 配置项或 null
   */
  @Get(':key')
  async getConfig(
    @Param('key') key: string,
    @UserParams() user?: UserJwtPayload,
  ): Promise<IConfigResponseDto | null> {
    return this.systemConfigService.getConfig(key, user);
  }

  /**
   * 批量读取配置项
   * - 普通配置：公开访问
   * - SYSTEM_ 配置：需要管理员（内部校验）
   * @param payload 包含 key 列表
   * @param user 可选的当前用户
   * @returns key -> 配置项/空 的映射
   */
  @Post('batch')
  async batchGetConfigs(
    @Body() payload: BatchConfigDto,
    @UserParams() user?: UserJwtPayload,
  ): Promise<ConfigBatchRecord> {
    return this.systemConfigService.batchGetConfigs(payload, user);
  }

  /**
   * 设置或创建配置项
   * - 普通配置：管理员可写
   * - SYSTEM_ 配置：管理员读写
   * @param payload 配置数据
   * @param user 当前管理员
   * @returns 配置项
   */
  @Put()
  @AuthRoles('admin')
  async setConfig(
    @Body() payload: SetConfigDto,
    @UserParams() user: UserJwtPayload,
  ): Promise<IConfigResponseDto> {
    return this.systemConfigService.setConfig(payload, user);
  }

  /**
   * 初始化系统基础配置
   * - 需要管理员权限
   * - 防重复调用：如果系统已初始化则拒绝
   * @param user 当前管理员
   * @returns 初始化成功消息
   */
  @Post('init')
  @AuthRoles('admin')
  async initializeSystem(
    @UserParams() user: UserJwtPayload,
  ): Promise<IInitResponseDto> {
    const message = await this.systemConfigService.initializeSystem(user);
    return { message };
  }

  /**
   * 数据迁移接口
   * - 需要管理员权限
   * - 支持从不同的博客系统迁移数据到 AppLog
   * @param payload 迁移请求参数（包含数据源类型、数据库配置等）
   * @param user 当前管理员
   * @returns 迁移结果（包含导入统计信息）
   */
  @Post('migrate')
  @HttpCode(200)
  @AuthRoles('admin')
  async migrateData(
    @Body() payload: MigrateDataDto,
    @UserParams() user: UserJwtPayload,
  ): Promise<IMigrationResultDto> {
    return this.migrationService.migrate(payload, user);
  }
}
