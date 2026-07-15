import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { PageService } from './page.service';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import {
  CreatePageDto,
  UpdatePageDto,
  QueryPageDto,
  IncludeUnpublishedQueryDto,
} from './dto';
import type {
  IPageResponseDto,
  IPageListItemDto,
  IPageNavItemDto,
} from './dto';
import type { Pagination } from 'nestjs-typeorm-paginate';

@Controller({
  path: 'page',
  version: [VERSION_NEUTRAL, '1'],
})
export class PageController {
  constructor(private readonly pageService: PageService) {}

  /**
   * 获取页面列表（支持分页、搜索、标签筛选）
   * 默认仅返回 published；admin + includeUnpublished=true 可查看全量
   * @param queryDto 查询参数
   * @param user 可选的当前用户
   * @returns 分页的页面列表
   */
  @Get()
  async findAll(
    @Query() queryDto: QueryPageDto,
    @UserParams() user?: UserJwtPayload,
  ): Promise<Pagination<IPageListItemDto>> {
    return this.pageService.findAll(queryDto, user);
  }

  /**
   * 获取所有设置了 showInNav 或 showInFooter 的页面
   * 用于导航栏和footer展示
   * @returns 导航/Footer页面列表
   */
  @Get('nav')
  async findNavPages(): Promise<IPageNavItemDto[]> {
    return this.pageService.findNavPages();
  }

  /**
   * 通过slug获取单个页面详情
   * 默认仅返回 published；admin + includeUnpublished=true 可查看草稿/归档
   * @param slug 页面slug
   * @param query 是否包含未发布内容
   * @param user 可选的当前用户
   * @returns 页面详情
   */
  @Get('slug/:slug')
  async findBySlug(
    @Param('slug') slug: string,
    @Query() query: IncludeUnpublishedQueryDto,
    @UserParams() user?: UserJwtPayload,
  ): Promise<IPageResponseDto> {
    return this.pageService.findBySlug(slug, {
      includeUnpublished: query.includeUnpublished,
      user,
    });
  }

  /**
   * 通过ID获取单个页面详情
   * 默认仅返回 published；admin + includeUnpublished=true 可查看草稿/归档
   * @param id 页面ID
   * @param query 是否包含未发布内容
   * @param user 可选的当前用户
   * @returns 页面详情
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query() query: IncludeUnpublishedQueryDto,
    @UserParams() user?: UserJwtPayload,
  ): Promise<IPageResponseDto> {
    return this.pageService.findOne(Number(id), {
      includeUnpublished: query.includeUnpublished,
      user,
    });
  }

  /**
   * 创建页面
   * @param createDto 创建页面的数据
   * @param user 当前登录的管理员用户
   * @returns 创建后的页面信息
   */
  @Post()
  @AuthRoles('admin')
  async create(
    @Body() createDto: CreatePageDto,
    @UserParams() user: UserJwtPayload,
  ): Promise<IPageResponseDto> {
    return this.pageService.create(createDto, user.id);
  }

  /**
   * 更新页面（局部更新）
   * @param id 页面ID
   * @param updateDto 更新数据
   * @returns 更新后的页面信息
   */
  @Patch(':id')
  @AuthRoles('admin')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePageDto,
  ): Promise<IPageResponseDto> {
    return this.pageService.update(Number(id), updateDto);
  }

  /**
   * 删除页面
   * @param id 页面ID
   * @returns 删除成功的消息
   */
  @Delete(':id')
  @AuthRoles('admin')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.pageService.remove(Number(id));
    return { message: '页面删除成功' };
  }
}
