import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import { isNil } from 'lodash';
import type { UserJwtPayload } from '@reus-able/types';
import type { ISystemBaseConfig } from '@applog/common';
import { SYSTEM_CONFIG_KEYS, SYSTEM_CONFIG_PREFIX_DEFAULT } from '@applog/common';
import { SystemConfigEntity } from '@/entities';
import type {
  BatchConfigDto,
  ConfigBatchRecord,
  IConfigResponseDto,
  SetConfigDto,
} from './dto';

type AccessAction = 'read' | 'write';

@Injectable()
export class SystemConfigService {
  @InjectRepository(SystemConfigEntity)
  private configRepo: Repository<SystemConfigEntity>;

  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  private readonly systemKeyPrefix: string;
  private readonly adminRoleValue: number;

  public constructor(private config: ConfigService) {
    this.systemKeyPrefix = this.config.get<string>(
      'SYSTEM_CONFIG_PREFIX',
      SYSTEM_CONFIG_PREFIX_DEFAULT,
    );
    this.adminRoleValue = this.config.get<number>('SYSTEM_ADMIN_ROLE_VALUE', 0);
  }

  private log(message: string) {
    this.logger.log(message, SystemConfigService.name);
  }

  private warn(message: string) {
    this.logger.warn(message, SystemConfigService.name);
  }

  private error(message: string) {
    this.logger.error(message, SystemConfigService.name);
  }

  private isAdmin(user?: UserJwtPayload): boolean {
    return user?.role === this.adminRoleValue;
  }

  private ensureSystemKeyAccess(
    configKey: string,
    action: AccessAction,
    user?: UserJwtPayload,
  ): void {
    if (!configKey.startsWith(this.systemKeyPrefix)) {
      return;
    }

    if (!this.isAdmin(user)) {
      this.warn(
        `非管理员尝试 ${action} 系统级配置: ${configKey}, user=${user?.id ?? 'anonymous'}`,
      );
      throw new BusinessException('SYSTEM_ 配置仅允许管理员访问');
    }
  }

  private mapEntity(entity: SystemConfigEntity): IConfigResponseDto {
    return entity.getData();
  }

  /**
   * 设置或创建配置项
   * @param payload 设置配置的数据
   * @param user 当前操作用户（需要 admin 权限）
   * @returns 配置项信息
   *
   * 逻辑说明：
   * 1. 校验 SYSTEM_ 配置的访问权限
   * 2. 查询配置项是否存在，不存在则创建
   * 3. 更新配置值及描述等附加信息
   * 4. 保存记录并返回
   */
  async setConfig(
    payload: SetConfigDto,
    user: UserJwtPayload,
  ): Promise<IConfigResponseDto> {
    this.log(`准备设置配置: ${payload.configKey}`);
    this.ensureSystemKeyAccess(payload.configKey, 'write', user);

    try {
      let config = await this.configRepo.findOne({
        where: { configKey: payload.configKey },
      });

      if (isNil(config)) {
        this.log(`配置 ${payload.configKey} 不存在，创建新记录`);
        config = this.configRepo.create({
          configKey: payload.configKey,
          configValue: payload.configValue,
          description: payload.description,
          extra: payload.extra,
        });
      } else {
        config.configValue = payload.configValue;

        if (payload.description !== undefined) {
          config.description = payload.description;
        }

        if (payload.extra !== undefined) {
          config.extra = payload.extra;
        }
      }

      const saved = await this.configRepo.save(config);
      this.log(`配置 ${payload.configKey} 设置成功 (ID: ${saved.id})`);
      return this.mapEntity(saved);
    } catch (err) {
      this.error(`配置 ${payload.configKey} 设置失败: ${err.message}`);
      throw new BusinessException('保存配置失败，请稍后重试');
    }
  }

  /**
   * 获取单个配置项
   * @param configKey 配置 key
   * @param user 当前用户（SYSTEM_ 配置需要 admin）
   * @returns 配置数据或 null
   *
   * 逻辑说明：
   * 1. 校验 SYSTEM_ 配置读取权限
   * 2. 查询数据库，记录不存在返回 null
   * 3. 返回配置数据
   */
  async getConfig(
    configKey: string,
    user?: UserJwtPayload,
  ): Promise<IConfigResponseDto | null> {
    this.log(`查询配置: ${configKey}`);
    this.ensureSystemKeyAccess(configKey, 'read', user);

    try {
      const config = await this.configRepo.findOne({ where: { configKey } });
      if (isNil(config)) {
        this.warn(`配置 ${configKey} 不存在`);
        return null;
      }
      return this.mapEntity(config);
    } catch (err) {
      this.error(`查询配置 ${configKey} 失败: ${err.message}`);
      throw new BusinessException('查询配置失败，请稍后重试');
    }
  }

  /**
   * 批量获取配置项
   * @param payload 包含配置 key 列表的 DTO
   * @param user 当前用户（SYSTEM_ 配置需要 admin）
   * @returns 配置记录 Map（不存在的 key 返回 null）
   *
   * 逻辑说明：
   * 1. 校验所有 key 的 SYSTEM_ 访问权限
   * 2. 去重后批量查询
   * 3. 将结果映射回请求顺序
   */
  async batchGetConfigs(
    payload: BatchConfigDto,
    user?: UserJwtPayload,
  ): Promise<ConfigBatchRecord> {
    this.log(
      `批量查询配置，共 ${payload.keys.length} 个 key: ${payload.keys.join(', ')}`,
    );

    payload.keys.forEach((key) =>
      this.ensureSystemKeyAccess(key, 'read', user),
    );

    try {
      const uniqueKeys = Array.from(new Set(payload.keys));
      const configs = await this.configRepo.find({
        where: { configKey: In(uniqueKeys) },
      });

      const configMap: Record<string, IConfigResponseDto> = {};
      configs.forEach((config) => {
        configMap[config.configKey] = this.mapEntity(config);
      });

      return payload.keys.reduce<ConfigBatchRecord>((acc, key) => {
        acc[key] = configMap[key] ?? null;
        return acc;
      }, {});
    } catch (err) {
      this.error(`批量查询配置失败: ${err.message}`);
      throw new BusinessException('批量查询配置失败，请稍后重试');
    }
  }

  /**
   * 初始化系统基础配置
   * @param user 当前操作用户（需要 admin 权限）
   * @returns 成功消息
   *
   * 逻辑说明：
   * 1. 生成系统配置 key（使用 systemKeyPrefix + 'BASE_CONFIG'）
   * 2. 检查配置是否已存在，如果存在则抛出异常（防重复调用）
   * 3. 创建默认系统配置值
   * 4. 将配置值序列化为 JSON 字符串存储
   * 5. 保存配置到数据库
   * @throws {BusinessException} 如果系统已初始化，则抛出异常
   */
  async initializeSystem(user: UserJwtPayload): Promise<string> {
    const configKey = `${this.systemKeyPrefix}${SYSTEM_CONFIG_KEYS.BASE_CONFIG}`;
    this.log(`准备初始化系统配置: ${configKey}`);

    // 校验管理员权限
    this.ensureSystemKeyAccess(configKey, 'write', user);

    try {
      // 检查配置是否已存在（防重复调用）
      const existingConfig = await this.configRepo.findOne({
        where: { configKey },
      });

      if (!isNil(existingConfig)) {
        this.warn(`系统配置 ${configKey} 已存在，无法重复初始化`);
        throw new BusinessException('系统已初始化，无法重复初始化');
      }

      // 创建默认系统配置
      const defaultConfig: ISystemBaseConfig = {
        title: '',
        description: '',
        allowUserLogin: true,
        allowComment: true,
      };

      // 创建配置实体
      const config = this.configRepo.create({
        configKey,
        configValue: JSON.stringify(defaultConfig),
        description: '系统基础配置',
        extra: {
          type: 'ISystemBaseConfig',
        },
      });

      // 保存配置
      const saved = await this.configRepo.save(config);
      this.log(`系统配置初始化成功 (ID: ${saved.id})`);

      return '系统初始化成功';
    } catch (err) {
      if (err instanceof BusinessException) {
        throw err;
      }
      this.error(`系统配置初始化失败: ${err.message}`);
      throw new BusinessException('系统初始化失败，请稍后重试');
    }
  }
}
