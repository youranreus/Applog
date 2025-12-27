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
import { PostService } from './post.service';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import { CreatePostDto, UpdatePostDto, QueryPostDto } from './dto';
import type { IPostResponseDto, IPostListItemDto } from './dto';
import type { Pagination } from 'nestjs-typeorm-paginate';

@Controller({
  path: 'post',
  version: [VERSION_NEUTRAL, '1'],
})
export class PostController {
  constructor(private readonly postService: PostService) {}

  /**
   * 获取文章列表（支持分页、搜索、标签筛选）
   * @param queryDto 查询参数
   * @returns 分页的文章列表
   */
  @Get()
  async findAll(
    @Query() queryDto: QueryPostDto,
  ): Promise<Pagination<IPostListItemDto>> {
    return this.postService.findAll(queryDto);
  }

  /**
   * 获取文章详情
   * @param slug 文章 slug
   * @returns 文章详细信息（包含完整内容）
   */
  @Get(':slug')
  async findOne(@Param('slug') slug: string): Promise<IPostResponseDto> {
    return this.postService.findOne(slug);
  }

  /**
   * 创建文章
   * @param createDto 创建文章的数据
   * @param user 当前登录的管理员用户
   * @returns 创建后的文章信息
   */
  @Post()
  @AuthRoles('admin')
  async create(
    @Body() createDto: CreatePostDto,
    @UserParams() user: UserJwtPayload,
  ): Promise<IPostResponseDto> {
    return this.postService.create(createDto, user.id);
  }

  /**
   * 更新文章（局部更新）
   * @param slug 文章 slug
   * @param updateDto 更新数据
   * @returns 更新后的文章信息
   */
  @Patch(':slug')
  @AuthRoles('admin')
  async update(
    @Param('slug') slug: string,
    @Body() updateDto: UpdatePostDto,
  ): Promise<IPostResponseDto> {
    return this.postService.update(slug, updateDto);
  }

  /**
   * 删除文章
   * @param slug 文章 slug
   * @returns 删除成功的消息
   */
  @Delete(':slug')
  @AuthRoles('admin')
  async remove(@Param('slug') slug: string): Promise<{ message: string }> {
    await this.postService.remove(slug);
    return { message: '文章删除成功' };
  }
}
