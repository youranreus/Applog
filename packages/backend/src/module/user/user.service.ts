import { Inject, Injectable } from '@nestjs/common';
import { UserEntity, PostEntity, PageEntity, CommentEntity } from '@/entities';
import { ConfigService } from '@nestjs/config';
import { isNil } from 'lodash';
import * as jwt from 'jsonwebtoken';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  ILoginResponseDto,
  IUserResponseDto,
  IUserOverviewDto,
} from './dto';
import type { UpdateUserDto } from './dto';
import { mapUserRoleToJwtRole, USER_ROLES } from '@/utils/types';
import type { OidcClaims } from './oidc.service';

@Injectable()
export class UserService {
  @InjectRepository(UserEntity)
  private userRepo: Repository<UserEntity>;

  @InjectRepository(PostEntity)
  private postRepo: Repository<PostEntity>;

  @InjectRepository(PageEntity)
  private pageRepo: Repository<PageEntity>;

  @InjectRepository(CommentEntity)
  private commentRepo: Repository<CommentEntity>;

  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  public constructor(private config: ConfigService) {}

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
   * 将经过协议校验的 OIDC claims 绑定到本地用户并签发 Applog JWT。
   */
  async loginWithOidc(claims: OidcClaims): Promise<ILoginResponseDto> {
    let user = await this.userRepo.findOne({
      where: { oidcIssuer: claims.iss, oidcSubject: claims.sub },
    });
    if (!user && /^\d+$/.test(claims.sub)) {
      const legacy = await this.userRepo.findOne({
        where: { ssoId: Number(claims.sub) },
      });
      if (legacy && !legacy.oidcIssuer && !legacy.oidcSubject) user = legacy;
    }
    const email = claims.email;
    if (!user) {
      user = this.userRepo.create({
        ssoId: null,
        oidcIssuer: claims.iss,
        oidcSubject: claims.sub,
        name: claims.nickname || email.split('@')[0] || '用户',
        email,
        avatar: claims.picture || null,
        role: USER_ROLES.USER,
      });
    } else {
      user.oidcIssuer = claims.iss;
      user.oidcSubject = claims.sub;
      user.email = email;
      user.name = claims.nickname || user.name;
      user.avatar = claims.picture || user.avatar;
    }
    try {
      user = await this.userRepo.save(user);
    } catch (error) {
      user = await this.userRepo.findOne({
        where: { oidcIssuer: claims.iss, oidcSubject: claims.sub },
      });
      if (!user) throw error;
    }
    return { user: user.getData(), token: this.generateToken(user) };
  }

  /**
   * 生成 JWT Token
   * @param user 用户实体
   * @returns JWT token 字符串
   *
   * 逻辑说明：
   * 1. 获取 TOKEN_SECRET 配置
   * 2. 构建 JWT payload，使用数据库 id（而非 ssoId）
   * 3. 将字符串 role 转换为数字（符合 @reus-able/types 定义）
   * 4. 使用 jsonwebtoken 生成 token，有效期 3 天
   */
  private generateToken(user: UserEntity): string {
    const tokenSecret = this.config.get<string>('TOKEN_SECRET');
    if (!tokenSecret) {
      this.error('TOKEN_SECRET 未配置');
      throw new BusinessException('系统配置错误');
    }

    const payload = {
      id: user.id, // 使用数据库自增 id
      email: user.email,
      role: mapUserRoleToJwtRole(user.role), // 将字符串 role 转换为数字
      refresh: false,
    };

    try {
      const token = jwt.sign(payload, tokenSecret, {
        expiresIn: '3d',
      });
      this.log(
        `JWT token 生成成功，数据库ID: ${user.id}，外部身份已绑定: ${Boolean(user.oidcSubject)}，有效期: 3 天`,
      );
      return token;
    } catch (error) {
      this.error(`JWT token 生成失败: ${error.message}`);
      throw new BusinessException('生成登录凭证失败');
    }
  }

  /**
   * 获取用户信息
   * @param id 用户数据库 ID（来自 JWT）
   * @returns 用户信息
   */
  async findOne(id: number): Promise<IUserResponseDto> {
    this.log(`查询用户信息，数据库ID: ${id}`);

    try {
      const user = await this.userRepo.findOne({ where: { id } });

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

  /**
   * 更新用户信息
   * @param id 用户数据库 ID（来自 JWT）
   * @param updateData 更新数据
   * @returns 更新后的用户信息
   */
  async updateUser(
    id: number,
    updateData: UpdateUserDto,
  ): Promise<IUserResponseDto> {
    this.log(`开始更新用户 #${id} 信息`);

    try {
      // 查询用户是否存在
      const user = await this.userRepo.findOne({ where: { id } });

      if (isNil(user)) {
        this.warn(`用户 #${id} 不存在`);
        throw new BusinessException('用户不存在');
      }

      // 更新用户信息
      if (updateData.name !== undefined) {
        user.name = updateData.name;
        this.log(`更新用户 #${id} 名称: ${updateData.name}`);
      }

      if (updateData.avatar !== undefined) {
        user.avatar = updateData.avatar;
        this.log(`更新用户 #${id} 头像`);
      }

      // 保存到数据库
      const savedUser = await this.userRepo.save(user);
      this.log(`用户 #${id} 信息更新成功`);

      return savedUser.getData();
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`更新用户信息失败: ${error.message}`);
      throw new BusinessException('更新用户信息失败');
    }
  }

  /**
   * 获取用户创作概览信息
   * @param id 用户数据库 ID（来自 JWT）
   * @returns 用户创作概览信息
   *
   * 逻辑说明：
   * 1. 统计用户作为作者的文章数量（authorId = userId）
   * 2. 统计用户作为作者的页面数量（authorId = userId）
   * 3. 统计用户发表的评论数量（authorId = userId）
   * 4. 统计用户作为作者的文章收到的评论数量（通过 JOIN 查询 post.authorId = userId）
   * 5. 返回包含所有统计数据的概览对象
   */
  async getOverview(id: number): Promise<IUserOverviewDto> {
    this.log(`查询用户 #${id} 创作概览信息`);

    try {
      // 并行执行所有统计查询以提高性能
      const [postCount, pageCount, commentCount, receivedCommentCount] =
        await Promise.all([
          // 统计文章数量
          this.postRepo.count({ where: { authorId: id } }),
          // 统计页面数量
          this.pageRepo.count({ where: { authorId: id } }),
          // 统计用户发表的评论数量
          this.commentRepo.count({ where: { authorId: id } }),
          // 统计用户作为作者的文章收到的评论数量
          this.commentRepo
            .createQueryBuilder('comment')
            .innerJoin('comment.post', 'post')
            .where('post.authorId = :userId', { userId: id })
            .getCount(),
        ]);

      this.log(
        `用户 #${id} 创作概览：文章 ${postCount}，页面 ${pageCount}，评论 ${commentCount}，收到评论 ${receivedCommentCount}`,
      );

      return {
        postCount,
        pageCount,
        commentCount,
        receivedCommentCount,
      };
    } catch (error) {
      this.error(`查询用户创作概览失败: ${error.message}`);
      throw new BusinessException('查询创作概览失败');
    }
  }
}
