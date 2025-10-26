import { Inject, Injectable } from '@nestjs/common';
import { UserEntity } from '@/entities';
import { ConfigService } from '@nestjs/config';
import { UserAPI } from '@reus-able/sso-utils';
import { isNil } from 'lodash';
import dayjs from 'dayjs';
import * as jwt from 'jsonwebtoken';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

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

  async login(ticket: string) {
    this.log(`ticket尝试登录: ${ticket}`);
    const tokenRes = await this.userApi
      .authorizeToken(ticket)
      .then((res) => {
        return res.data;
      })
      .catch((e) => {
        return e.response.data;
      });

    if (tokenRes.code !== 0) {
      this.warn(`登录失败: ${tokenRes?.msg}`);
      return tokenRes;
    }

    const { access_token } = tokenRes.data;

    const userInfo = await this.userApi
      .getUserInfo(`Bearer ${access_token}`)
      .then((res) => res.data)
      .catch((e) => {
        return e.response.data;
      });

    if (userInfo.code !== 0) {
      this.warn(`登录失败: ${userInfo?.msg}`);
      return userInfo;
    }

    const { email, id, avatar } = userInfo.data;
    const dbUser = await this.userRepo.findOne({ where: { ssoId: id } });
    if (isNil(dbUser)) {
      const user = this.userRepo.create({
        ssoId: id,
        email,
        avatar,
        created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      });

      await this.userRepo.save(user);

      this.log(`新用户#${id}登录，创建新记录`);

      return {
        user: user.getData(),
        token: jwt.sign(
          {
            email,
            id,
          },
          this.config.get<string>('TOKEN_SECRET'),
          {
            expiresIn: '3d',
          },
        ),
      };
    }

    // 更新用户信息
    dbUser.email = email;
    dbUser.avatar = avatar;
    await this.userRepo.save(dbUser);

    this.log(`用户#${id}登录成功`);

    return {
      user: dbUser.getData(),
      token: jwt.sign(
        {
          email: dbUser.email,
          id: dbUser.ssoId,
        },
        this.config.get<string>('TOKEN_SECRET'),
        {
          expiresIn: '3d',
        },
      ),
    };
  }

  async findOne(id: number) {
    this.log(`获取用户#${id}信息`);

    const user = await this.userRepo.findOne({ where: { ssoId: id } });
    if (isNil(user)) {
      throw new BusinessException('id错误');
    }

    return user.getData();
  }
}
