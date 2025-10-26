import { Inject, Injectable } from '@nestjs/common';
import { UserEntity } from '@/entities';
import { ConfigService } from '@nestjs/config';
import { UserAPI } from '@reus-able/sso-utils';
import { isNil } from 'lodash';
import * as jwt from 'jsonwebtoken';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import type { ILoginResponseDto, IUserResponseDto } from './dto';
import { mapSsoRoleToUserRole } from '@/utils/types';

@Injectable()
export class UserService {
  @InjectRepository(UserEntity)
  private userRepo: Repository<UserEntity>;

  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  private userApi: ReturnType<typeof UserAPI>;

  public constructor(private config: ConfigService) {
    const apiEnv = {
      SSO_ID: this.config.get<string>('SSO_ID'),
      SSO_URL: this.config.get<string>('SSO_URL'),
      SSO_SECRET: this.config.get<string>('SSO_SECRET'),
      SSO_REDIRECT: this.config.get<string>('SSO_REDIRECT'),
    };

    this.userApi = UserAPI(apiEnv);
  }

  private log(text: string) {
    this.logger.log(text, UserService.name);
  }

  private warn(text: string) {
    this.logger.warn(text, UserService.name);
  }

  private error(text: string) {
    this.logger.error(text, UserService.name);
  }

  /**
   * 用户登录
   * @param ticket SSO ticket
   * @returns 登录响应（包含用户信息和 token）
   */
  async login(ticket: string): Promise<ILoginResponseDto> {
    this.log(`开始处理登录请求，ticket: ${ticket}`);

    // 步骤1: 使用 ticket 换取 access_token
    this.log(`正在通过 ticket 获取 access_token...`);
    let tokenRes;
    try {
      const response = await this.userApi.authorizeToken(ticket);
      tokenRes = response.data;
      this.log(`成功获取 access_token`);
    } catch (e) {
      this.error(`获取 access_token 失败: ${e.message}`);
      tokenRes = e.response?.data || { code: -1, msg: '获取 token 失败' };
    }

    if (tokenRes.code !== 0) {
      this.warn(`Token 验证失败: ${tokenRes?.msg}`);
      throw new BusinessException(tokenRes?.msg || 'SSO 认证失败，请重试');
    }

    const { access_token } = tokenRes.data;
    this.log(`Access token 获取成功`);

    // 步骤2: 使用 access_token 获取用户信息
    this.log(`正在获取 SSO 用户信息...`);
    let userInfo;
    try {
      const response = await this.userApi.getUserInfo(`Bearer ${access_token}`);
      userInfo = response.data;
      this.log(`成功获取 SSO 用户信息`);
    } catch (e) {
      this.error(`获取用户信息失败: ${e.message}`);
      userInfo = e.response?.data || { code: -1, msg: '获取用户信息失败' };
    }

    if (userInfo.code !== 0) {
      this.warn(`获取用户信息失败: ${userInfo?.msg}`);
      throw new BusinessException(userInfo?.msg || '获取用户信息失败，请重试');
    }

    const { email, id, avatar, name, role: ssoRole } = userInfo.data;
    const userRole = mapSsoRoleToUserRole(ssoRole);
    this.log(
      `SSO 用户信息: id=${id}, email=${email}, name=${name}, role=${ssoRole}(${userRole})`,
    );

    // 步骤3: 查询本地数据库用户
    this.log(`查询本地用户数据，ssoId: ${id}`);
    const dbUser = await this.userRepo.findOne({ where: { ssoId: id } });

    if (isNil(dbUser)) {
      // 新用户，创建记录
      this.log(`用户 #${id} 不存在，创建新用户记录`);

      try {
        const newUser = this.userRepo.create({
          ssoId: id,
          name: name || email.split('@')[0], // 如果没有 name，使用 email 前缀
          email,
          avatar: avatar || null,
          role: userRole,
        });

        const savedUser = await this.userRepo.save(newUser);
        this.log(
          `新用户 #${id} 创建成功，数据库 ID: ${savedUser.id}, 角色: ${userRole}`,
        );

        // 生成 JWT token
        const token = this.generateToken(savedUser);
        this.log(`为用户 #${id} 生成 JWT token 成功`);

        return {
          user: savedUser.getData(),
          token,
        };
      } catch (error) {
        this.error(`创建新用户失败: ${error.message}`);
        throw new BusinessException('创建用户失败，请稍后重试');
      }
    }

    // 现有用户，更新信息
    this.log(`用户 #${id} 已存在`);

    try {
      // 生成 JWT token
      const token = this.generateToken(dbUser);
      this.log(`用户 #${id} 登录成功`);

      return {
        user: dbUser.getData(),
        token,
      };
    } catch (error) {
      this.error(`更新用户信息失败: ${error.message}`);
      throw new BusinessException('更新用户信息失败，请稍后重试');
    }
  }

  /**
   * 生成 JWT Token
   * @param user 用户实体
   * @returns JWT token 字符串
   */
  private generateToken(user: UserEntity): string {
    const tokenSecret = this.config.get<string>('TOKEN_SECRET');
    if (!tokenSecret) {
      this.error('TOKEN_SECRET 未配置');
      throw new BusinessException('系统配置错误');
    }

    const payload = {
      id: user.ssoId,
      username: user.name,
      email: user.email,
      role: user.role,
    };

    try {
      const token = jwt.sign(payload, tokenSecret, {
        expiresIn: '3d',
      });
      this.log(`JWT token 生成成功，有效期: 3 天`);
      return token;
    } catch (error) {
      this.error(`JWT token 生成失败: ${error.message}`);
      throw new BusinessException('生成登录凭证失败');
    }
  }

  /**
   * 获取用户信息
   * @param id SSO 用户 ID
   * @returns 用户信息
   */
  async findOne(id: number): Promise<IUserResponseDto> {
    this.log(`查询用户信息，ssoId: ${id}`);

    try {
      const user = await this.userRepo.findOne({ where: { ssoId: id } });

      if (isNil(user)) {
        this.warn(`用户 #${id} 不存在`);
        throw new BusinessException('用户不存在');
      }

      this.log(`成功获取用户 #${id} 信息`);
      return user.getData();
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`查询用户信息失败: ${error.message}`);
      throw new BusinessException('查询用户信息失败');
    }
  }
}
