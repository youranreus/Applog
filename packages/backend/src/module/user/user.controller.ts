import {
  Controller,
  Get,
  Put,
  VERSION_NEUTRAL,
  Query,
  Body,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import { LoginDto, UpdateUserDto } from './dto';
import type {
  ILoginResponseDto,
  IUserResponseDto,
  IUserOverviewDto,
} from './dto';

@Controller({
  path: 'user',
  version: [VERSION_NEUTRAL, '1'],
})
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 用户登录（SSO 第三方登录）
   * @param loginDto 登录请求参数
   * @returns 登录响应（包含用户信息和 JWT token）
   */
  @Get('login')
  async login(@Query() loginDto: LoginDto): Promise<ILoginResponseDto> {
    return this.userService.login(loginDto.ticket);
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
