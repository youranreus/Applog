import {
  Controller,
  Get,
  Put,
  VERSION_NEUTRAL,
  Query,
  Body,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AuthRoles, BusinessException, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import { UpdateUserDto } from './dto';
import type {
  ILoginResponseDto,
  IUserResponseDto,
  IUserOverviewDto,
} from './dto';
import { OidcService, type OidcTransaction } from './oidc.service';

interface OidcRequest {
  headers: { cookie?: string; host?: string };
  raw: { url: string };
}

interface OidcReply {
  header(name: string, value: string | string[]): OidcReply;
  redirect(url: string): unknown;
}

interface OidcCompletion {
  result: ILoginResponseDto;
  createdAt: number;
}

@Controller({
  path: 'user',
  version: [VERSION_NEUTRAL, '1'],
})
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly oidcService: OidcService,
  ) {}

  /**
   * 启动后端托管的 OIDC 登录。
   */
  @Get('oidc/login')
  async login(
    @Query('returnPath') returnPath: string,
    @Res() reply: OidcReply,
  ): Promise<unknown> {
    const { url, transaction } = await this.oidcService.begin(returnPath);
    reply.header(
      'Set-Cookie',
      this.oidcService.cookie(
        'oidc_tx',
        this.oidcService.seal(transaction),
        this.oidcService.transactionTtl(),
      ),
    );
    return reply.redirect(url.toString());
  }

  @Get('oidc/callback')
  async callback(
    @Req() request: OidcRequest,
    @Res() reply: OidcReply,
  ): Promise<unknown> {
    const cookies = this.parseCookies(request.headers.cookie);
    const clearTransaction = this.oidcService.cookie('oidc_tx', '', 0);
    const frontUrl = this.oidcService.frontUrl();
    try {
      const transaction = this.oidcService.open<OidcTransaction>(
        cookies.oidc_tx,
      );
      if (!transaction) throw new Error('missing_transaction');
      const claims = await this.oidcService.finish(
        this.oidcService.callbackUrl(request.raw.url),
        transaction,
      );
      const result = await this.userService.loginWithOidc(claims);
      const completion = this.oidcService.seal({
        result,
        createdAt: Date.now(),
      });
      reply.header('Set-Cookie', [
        clearTransaction,
        this.oidcService.cookie(
          'oidc_completion',
          completion,
          this.oidcService.completionTtl(),
        ),
      ]);
      return reply.redirect(`${frontUrl}/user/callback`);
    } catch (error) {
      this.oidcService.logCallbackFailure(error);
      reply.header('Set-Cookie', clearTransaction);
      return reply.redirect(`${frontUrl}/user/callback?error=login_failed`);
    }
  }

  @Post('oidc/complete')
  async complete(
    @Req() request: OidcRequest,
    @Res({ passthrough: true }) reply: OidcReply,
  ): Promise<ILoginResponseDto> {
    const completion = this.oidcService.open<OidcCompletion>(
      this.parseCookies(request.headers.cookie).oidc_completion,
    );
    reply.header(
      'Set-Cookie',
      this.oidcService.cookie('oidc_completion', '', 0),
    );
    if (
      !completion ||
      Date.now() - completion.createdAt > this.oidcService.completionTtl()
    ) {
      throw new BusinessException('登录会话无效或已过期');
    }
    return completion.result;
  }

  private parseCookies(header?: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    for (const part of (header || '').split(';')) {
      const separator = part.indexOf('=');
      if (separator < 1) continue;
      const key = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        // Ignore malformed cookies and let the caller return a generic error.
      }
    }
    return cookies;
  }

  /**
   * 获取当前登录用户信息
   * @param user 当前登录用户（从 JWT 解析）
   * @returns 用户信息
   */
  @Get('data')
  @AuthRoles('user')
  async findOne(@UserParams() user: UserJwtPayload): Promise<IUserResponseDto> {
    return this.userService.findOne(user.id);
  }

  /**
   * 更新当前登录用户信息
   * @param user 当前登录用户（从 JWT 解析）
   * @param updateData 更新数据（用户名和头像）
   * @returns 更新后的用户信息
   */
  @Put('data')
  @AuthRoles('user')
  async updateUser(
    @UserParams() user: UserJwtPayload,
    @Body() updateData: UpdateUserDto,
  ): Promise<IUserResponseDto> {
    return this.userService.updateUser(user.id, updateData);
  }

  /**
   * 获取当前登录用户创作概览信息
   * @param user 当前登录用户（从 JWT 解析）
   * @returns 用户创作概览信息（文章数量、页面数量、评论数量、收到评论数量）
   */
  @Get('overview')
  @AuthRoles('user')
  async getOverview(
    @UserParams() user: UserJwtPayload,
  ): Promise<IUserOverviewDto> {
    return this.userService.getOverview(user.id);
  }
}
