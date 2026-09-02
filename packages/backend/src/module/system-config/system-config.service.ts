import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import { isNil } from 'lodash';
import type { UserJwtPayload } from '@reus-able/types';
import type {
  IDuolingoConfig,
  INotificationConfig,
  ISystemBaseConfig,
  IUmamiConfig,
} from '@applog/common';
import {
  DEFAULT_DUOLINGO_TIME_ZONE,
  SYSTEM_CONFIG_KEYS,
  SYSTEM_CONFIG_PREFIX_DEFAULT,
  getSystemConfigKey,
  isValidIanaTimeZone,
  maskDuolingoConfigJwt,
  maskNotificationMailToken,
  maskUmamiConfigPassword,
  shouldKeepExistingDuolingoJwt,
  shouldKeepExistingNotificationMailToken,
  normalizeNotificationConfig,
  shouldKeepExistingUmamiPassword,
  normalizeUmamiBaseUrl,
} from '@applog/common';
import { SystemConfigEntity } from '@/entities';
import type {
  BatchConfigDto,
  ConfigBatchRecord,
  IConfigResponseDto,
  SetConfigDto,
} from './dto';

type AccessAction = 'read' | 'write';
type BaseConfigChangeListener = () => void;

@Injectable()
export class SystemConfigService {
  @InjectRepository(SystemConfigEntity)
  private configRepo: Repository<SystemConfigEntity>;

  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  private readonly systemKeyPrefix: string;
  private readonly adminRoleValue: number;

  private readonly baseConfigChangeListeners =
    new Set<BaseConfigChangeListener>();
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

  /**
   * 完整 Umami 配置 key（含前缀）
   * @returns 如 SYSTEM_UMAMI_CONFIG
   */
  getUmamiConfigKey(): string {
    return getSystemConfigKey(
      SYSTEM_CONFIG_KEYS.UMAMI_CONFIG,
      this.systemKeyPrefix,
    );
  }

  /**
   * 完整 Duolingo 配置 key（含前缀）
   */
  getDuolingoConfigKey(): string {
    return getSystemConfigKey(
      SYSTEM_CONFIG_KEYS.DUOLINGO_CONFIG,
      this.systemKeyPrefix,
    );
  }

  getNotificationConfigKey(): string {
    return getSystemConfigKey(
      SYSTEM_CONFIG_KEYS.NOTIFICATION_CONFIG,
      this.systemKeyPrefix,
    );
  }

  /**
   * 完整系统基础配置 key（含前缀）
   * @returns 如 SYSTEM_BASE_CONFIG
   */
  getBaseConfigKey(): string {
    return getSystemConfigKey(
      SYSTEM_CONFIG_KEYS.BASE_CONFIG,
      this.systemKeyPrefix,
    );
  }

  /**
   * 注册基础配置变更监听器，用于依赖 base config 的后台快照立即刷新。
   * @param listener 基础配置保存成功后触发的回调
   * @returns 取消注册函数
   */
  onBaseConfigChanged(listener: BaseConfigChangeListener): () => void {
    this.baseConfigChangeListeners.add(listener);
    return () => {
      this.baseConfigChangeListeners.delete(listener);
    };
  }

  private notifyBaseConfigChanged(): void {
    for (const listener of this.baseConfigChangeListeners) {
      try {
        listener();
      } catch (error) {
        this.warn(
          `基础配置变更监听器执行失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  /**
   * 判断是否为 Umami 对接配置 key（含/不含前缀）
   * @param configKey - 请求中的 key
   * @returns 是否 Umami 配置
   */
  private isUmamiConfigKey(configKey: string): boolean {
    const fullKey = this.getUmamiConfigKey();
    return (
      configKey === fullKey ||
      configKey === SYSTEM_CONFIG_KEYS.UMAMI_CONFIG ||
      configKey === `${this.systemKeyPrefix}${SYSTEM_CONFIG_KEYS.UMAMI_CONFIG}`
    );
  }

  private isDuolingoConfigKey(configKey: string): boolean {
    const fullKey = this.getDuolingoConfigKey();
    return (
      configKey === fullKey ||
      configKey === SYSTEM_CONFIG_KEYS.DUOLINGO_CONFIG ||
      configKey ===
        `${this.systemKeyPrefix}${SYSTEM_CONFIG_KEYS.DUOLINGO_CONFIG}`
    );
  }

  private isNotificationConfigKey(configKey: string): boolean {
    return (
      configKey === this.getNotificationConfigKey() ||
      configKey === SYSTEM_CONFIG_KEYS.NOTIFICATION_CONFIG ||
      configKey ===
        `${this.systemKeyPrefix}${SYSTEM_CONFIG_KEYS.NOTIFICATION_CONFIG}`
    );
  }

  private isBaseConfigKey(configKey: string): boolean {
    return (
      configKey === this.getBaseConfigKey() ||
      configKey === SYSTEM_CONFIG_KEYS.BASE_CONFIG ||
      configKey === `${this.systemKeyPrefix}${SYSTEM_CONFIG_KEYS.BASE_CONFIG}`
    );
  }

  private validateBaseConfigValue(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BusinessException('系统基础配置格式无效');
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new BusinessException('系统基础配置格式无效');
    }
    const goal = (parsed as Record<string, unknown>).landingStepGoal;
    if (
      goal !== undefined &&
      (typeof goal !== 'number' ||
        !Number.isInteger(goal) ||
        goal < 1000 ||
        goal > 100000)
    ) {
      throw new BusinessException('目标步数必须是 1,000–100,000 之间的整数');
    }
  }

  private ensureSystemKeyAccess(
    configKey: string,
    action: AccessAction,
    user?: UserJwtPayload,
  ): void {
    // 第三方凭证：读写均仅管理员（优先于「SYSTEM_ 全员可读」）
    if (
      this.isUmamiConfigKey(configKey) ||
      this.isDuolingoConfigKey(configKey) ||
      this.isNotificationConfigKey(configKey)
    ) {
      if (!this.isAdmin(user)) {
        this.warn(
          `非管理员尝试 ${action} secret 配置: ${configKey}, user=${user?.id ?? 'anonymous'}`,
        );
        throw new BusinessException('该配置仅允许管理员访问');
      }
      return;
    }

    if (!configKey.startsWith(this.systemKeyPrefix)) {
      return;
    }

    // 读取操作：允许所有用户读取其余 SYSTEM_ 配置
    if (action === 'read') {
      return;
    }

    // 写入操作：仅允许管理员
    if (!this.isAdmin(user)) {
      this.warn(
        `非管理员尝试 ${action} 系统级配置: ${configKey}, user=${user?.id ?? 'anonymous'}`,
      );
      throw new BusinessException('SYSTEM_ 配置仅允许管理员修改');
    }
  }

  /**
   * 映射实体；Umami 配置经通用 getConfig 读回时强制脱敏密码
   * @param entity - 配置实体
   * @returns 响应 DTO
   */
  private mapEntity(entity: SystemConfigEntity): IConfigResponseDto {
    const data = entity.getData();
    if (
      !this.isUmamiConfigKey(entity.configKey) &&
      !this.isDuolingoConfigKey(entity.configKey) &&
      !this.isNotificationConfigKey(entity.configKey)
    ) {
      return data;
    }

    const masked = this.isNotificationConfigKey(entity.configKey)
      ? maskNotificationMailToken(
          this.parseNotificationConfigValue(data.configValue) ?? {
            mailToken: '',
            enabled: false,
          },
        )
      : this.isDuolingoConfigKey(entity.configKey)
        ? maskDuolingoConfigJwt(
            this.parseDuolingoConfigValue(data.configValue) ?? {
              username: '',
              jwt: '',
              timeZone: DEFAULT_DUOLINGO_TIME_ZONE,
              enabled: false,
            },
          )
        : maskUmamiConfigPassword(
            this.parseUmamiConfigValue(data.configValue) ?? {
              baseUrl: '',
              websiteId: '',
              scriptUrl: '',
              username: '',
              password: '',
              enabled: false,
            },
          );
    return {
      ...data,
      configValue: JSON.stringify(masked),
    };
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

    // Umami 含凭证：禁止经通用 setConfig 写入，避免脱敏占位覆盖明文密码
    if (
      this.isUmamiConfigKey(payload.configKey) ||
      this.isDuolingoConfigKey(payload.configKey) ||
      this.isNotificationConfigKey(payload.configKey)
    ) {
      throw new BusinessException('请使用对应的专用接口管理含凭证配置');
    }
    if (this.isBaseConfigKey(payload.configKey)) {
      this.validateBaseConfigValue(payload.configValue);
    }

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
      if (this.isBaseConfigKey(payload.configKey)) {
        this.notifyBaseConfigChanged();
      }
      return this.mapEntity(saved);
    } catch (err) {
      this.error(`配置 ${payload.configKey} 设置失败: ${err.message}`);
      throw new BusinessException('保存配置失败，请稍后重试');
    }
  }

  /**
   * 获取单个配置项
   * @param configKey 配置 key
   * @param user 当前用户（可选，SYSTEM_ 配置所有用户可读）
   * @returns 配置数据或 null
   *
   * 逻辑说明：
   * 1. SYSTEM_ 配置允许所有用户读取
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
   * @param user 当前用户（可选，SYSTEM_ 配置所有用户可读）
   * @returns 配置记录 Map（不存在的 key 返回 null）
   *
   * 逻辑说明：
   * 1. SYSTEM_ 配置允许所有用户读取
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
    const configKey = this.getBaseConfigKey();
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
        siteFoundedDate: '',
        icpFilingNumber: '',
        landingTitle: '',
        landingBio: '',
        landingSlogan: '',
        weatherCity: '',
        personalHomepageUrl: '/about.html',
        bilibiliUrl: '',
        githubUrl: '',
        landingStepGoal: undefined,
        tokscaleUsername: '',
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

  /**
   * 服务端读取系统基础配置。
   * @returns 配置；未初始化或 JSON 非法时返回 null
   */
  async getBaseConfigRaw(): Promise<ISystemBaseConfig | null> {
    const configKey = this.getBaseConfigKey();
    try {
      const entity = await this.configRepo.findOne({ where: { configKey } });
      if (isNil(entity)) {
        return null;
      }

      const parsed = JSON.parse(entity.configValue) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return parsed as ISystemBaseConfig;
    } catch (err) {
      this.error(`读取系统基础配置失败: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * 解析库中 Umami 配置 JSON
   * @param raw - configValue 字符串
   * @returns 解析结果或 null
   */
  private parseUmamiConfigValue(raw: string): IUmamiConfig | null {
    try {
      const parsed = JSON.parse(raw) as IUmamiConfig;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return {
        baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
        websiteId: typeof parsed.websiteId === 'string' ? parsed.websiteId : '',
        scriptUrl: typeof parsed.scriptUrl === 'string' ? parsed.scriptUrl : '',
        username: typeof parsed.username === 'string' ? parsed.username : '',
        password: typeof parsed.password === 'string' ? parsed.password : '',
        enabled: parsed.enabled,
      };
    } catch {
      return null;
    }
  }

  /**
   * 服务端读取完整 Umami 配置（含明文密码，勿下发前端）
   * @returns 配置或 null
   */
  async getUmamiConfigRaw(): Promise<IUmamiConfig | null> {
    const configKey = this.getUmamiConfigKey();
    try {
      const entity = await this.configRepo.findOne({ where: { configKey } });
      if (isNil(entity)) {
        return null;
      }
      return this.parseUmamiConfigValue(entity.configValue);
    } catch (err) {
      this.error(`读取 Umami 配置失败: ${(err as Error).message}`);
      throw new BusinessException('查询配置失败，请稍后重试');
    }
  }

  /**
   * 管理员读取脱敏后的 Umami 配置
   * @param user - 当前用户
   * @returns 脱敏配置；未配置时返回空表单默认值
   */
  async getUmamiConfigMasked(user: UserJwtPayload): Promise<IUmamiConfig> {
    this.ensureSystemKeyAccess(this.getUmamiConfigKey(), 'read', user);

    const raw = await this.getUmamiConfigRaw();
    if (!raw) {
      return {
        baseUrl: '',
        websiteId: '',
        scriptUrl: '',
        username: '',
        password: '',
        enabled: true,
      };
    }
    return maskUmamiConfigPassword(raw);
  }

  /**
   * 管理员写入 Umami 配置（空/占位密码表示保留原密码）
   * @param payload - 表单提交的配置
   * @param user - 当前管理员
   * @returns 脱敏后的最新配置
   */
  async setUmamiConfig(
    payload: IUmamiConfig,
    user: UserJwtPayload,
  ): Promise<IUmamiConfig> {
    const configKey = this.getUmamiConfigKey();
    this.ensureSystemKeyAccess(configKey, 'write', user);
    this.log(`准备保存 Umami 配置: ${configKey}`);

    try {
      const existing = await this.getUmamiConfigRaw();
      const nextPassword = shouldKeepExistingUmamiPassword(payload.password)
        ? (existing?.password ?? '')
        : (payload.password || '').trim();

      const toStore: IUmamiConfig = {
        baseUrl: normalizeUmamiBaseUrl(payload.baseUrl || ''),
        websiteId: (payload.websiteId || '').trim(),
        scriptUrl: (payload.scriptUrl || '').trim(),
        username: (payload.username || '').trim(),
        password: nextPassword,
        enabled: payload.enabled !== false,
      };

      let entity = await this.configRepo.findOne({ where: { configKey } });
      if (isNil(entity)) {
        entity = this.configRepo.create({
          configKey,
          configValue: JSON.stringify(toStore),
          description: 'Umami 流量分析对接配置',
          extra: { type: 'IUmamiConfig' },
        });
      } else {
        entity.configValue = JSON.stringify(toStore);
        entity.description = 'Umami 流量分析对接配置';
        entity.extra = { ...(entity.extra ?? {}), type: 'IUmamiConfig' };
      }

      await this.configRepo.save(entity);
      this.log(`Umami 配置保存成功`);
      return maskUmamiConfigPassword(toStore);
    } catch (err) {
      if (err instanceof BusinessException) {
        throw err;
      }
      this.error(`保存 Umami 配置失败: ${(err as Error).message}`);
      throw new BusinessException('保存配置失败，请稍后重试');
    }
  }

  private parseDuolingoConfigValue(raw: string): IDuolingoConfig | null {
    try {
      const parsed = JSON.parse(raw) as Partial<IDuolingoConfig>;
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        username: typeof parsed.username === 'string' ? parsed.username : '',
        jwt: typeof parsed.jwt === 'string' ? parsed.jwt : '',
        timeZone:
          typeof parsed.timeZone === 'string'
            ? parsed.timeZone
            : DEFAULT_DUOLINGO_TIME_ZONE,
        enabled: parsed.enabled === true,
      };
    } catch {
      return null;
    }
  }

  /**
   * 服务端读取完整 Duolingo 配置（含明文 JWT，勿下发前端）。
   */
  async getDuolingoConfigRaw(): Promise<IDuolingoConfig | null> {
    const configKey = this.getDuolingoConfigKey();
    try {
      const entity = await this.configRepo.findOne({ where: { configKey } });
      return entity ? this.parseDuolingoConfigValue(entity.configValue) : null;
    } catch (err) {
      this.error(`读取 Duolingo 配置失败: ${(err as Error).message}`);
      throw new BusinessException('查询配置失败，请稍后重试');
    }
  }

  /**
   * 管理员读取脱敏 Duolingo 配置。
   */
  async getDuolingoConfigMasked(
    user: UserJwtPayload,
  ): Promise<IDuolingoConfig> {
    this.ensureSystemKeyAccess(this.getDuolingoConfigKey(), 'read', user);
    const raw = await this.getDuolingoConfigRaw();
    return maskDuolingoConfigJwt(
      raw ?? {
        username: '',
        jwt: '',
        timeZone: DEFAULT_DUOLINGO_TIME_ZONE,
        enabled: false,
      },
    );
  }

  /**
   * 保存 Duolingo 配置。空 JWT 或脱敏占位保留现有 JWT。
   */
  async setDuolingoConfig(
    payload: IDuolingoConfig,
    user: UserJwtPayload,
  ): Promise<IDuolingoConfig> {
    const configKey = this.getDuolingoConfigKey();
    this.ensureSystemKeyAccess(configKey, 'write', user);
    const timeZone =
      (payload.timeZone || '').trim() || DEFAULT_DUOLINGO_TIME_ZONE;
    if (!isValidIanaTimeZone(timeZone)) {
      throw new BusinessException('请输入有效的 IANA 时区');
    }

    try {
      const existing = await this.getDuolingoConfigRaw();
      const jwt = shouldKeepExistingDuolingoJwt(payload.jwt)
        ? (existing?.jwt ?? '')
        : (payload.jwt || '').trim();
      const toStore: IDuolingoConfig = {
        username: (payload.username || '').trim(),
        jwt,
        timeZone,
        enabled: payload.enabled === true,
      };
      let entity = await this.configRepo.findOne({ where: { configKey } });
      if (isNil(entity)) {
        entity = this.configRepo.create({
          configKey,
          configValue: JSON.stringify(toStore),
          description: 'Duolingo Landing 学习统计配置',
          extra: { type: 'IDuolingoConfig' },
        });
      } else {
        entity.configValue = JSON.stringify(toStore);
        entity.description = 'Duolingo Landing 学习统计配置';
        entity.extra = { ...(entity.extra ?? {}), type: 'IDuolingoConfig' };
      }
      await this.configRepo.save(entity);
      this.log('Duolingo 配置保存成功');
      return maskDuolingoConfigJwt(toStore);
    } catch (err) {
      if (err instanceof BusinessException) throw err;
      this.error(`保存 Duolingo 配置失败: ${(err as Error).message}`);
      throw new BusinessException('保存配置失败，请稍后重试');
    }
  }

  private parseNotificationConfigValue(
    raw: string,
  ): INotificationConfig | null {
    try {
      const parsed = JSON.parse(raw) as Partial<INotificationConfig>;
      if (!parsed || typeof parsed !== 'object') return null;
      return normalizeNotificationConfig(parsed);
    } catch {
      return null;
    }
  }

  /** 服务端读取完整评论邮件配置（含明文 token，勿下发前端）。 */
  async getNotificationConfigRaw(): Promise<INotificationConfig | null> {
    const configKey = this.getNotificationConfigKey();
    try {
      const entity = await this.configRepo.findOne({ where: { configKey } });
      return entity
        ? this.parseNotificationConfigValue(entity.configValue)
        : null;
    } catch (err) {
      this.error(`读取评论邮件配置失败: ${(err as Error).message}`);
      throw new BusinessException('查询配置失败，请稍后重试');
    }
  }

  async getNotificationConfigMasked(
    user: UserJwtPayload,
  ): Promise<INotificationConfig> {
    this.ensureSystemKeyAccess(this.getNotificationConfigKey(), 'read', user);
    return maskNotificationMailToken(
      (await this.getNotificationConfigRaw()) ?? {
        mailToken: '',
        enabled: false,
      },
    );
  }

  async setNotificationConfig(
    payload: INotificationConfig,
    user: UserJwtPayload,
  ): Promise<INotificationConfig> {
    const configKey = this.getNotificationConfigKey();
    this.ensureSystemKeyAccess(configKey, 'write', user);
    try {
      const existing = await this.getNotificationConfigRaw();
      const mailToken = shouldKeepExistingNotificationMailToken(
        payload.mailToken,
      )
        ? (existing?.mailToken ?? '')
        : (payload.mailToken || '').trim();
      if (payload.enabled === true && !mailToken) {
        throw new BusinessException('启用评论邮件通知前请填写 mail token');
      }
      const toStore: INotificationConfig = {
        mailToken,
        enabled: payload.enabled === true,
      };
      let entity = await this.configRepo.findOne({ where: { configKey } });
      if (isNil(entity)) {
        entity = this.configRepo.create({
          configKey,
          configValue: JSON.stringify(toStore),
          description: '评论邮件通知配置',
          extra: { type: 'INotificationConfig' },
        });
      } else {
        entity.configValue = JSON.stringify(toStore);
        entity.description = '评论邮件通知配置';
        entity.extra = { ...(entity.extra ?? {}), type: 'INotificationConfig' };
      }
      await this.configRepo.save(entity);
      this.log('评论邮件通知配置保存成功');
      return maskNotificationMailToken(toStore);
    } catch (err) {
      if (err instanceof BusinessException) throw err;
      this.error(`保存评论邮件配置失败: ${(err as Error).message}`);
      throw new BusinessException('保存配置失败，请稍后重试');
    }
  }
}
