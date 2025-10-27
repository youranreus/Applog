import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { PostService } from './post.service';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import { CreatePostDto, QueryPostDto } from './dto';
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
   * 删除文章
   * @param id 文章ID
   * @returns 删除成功的消息
   */
  @Delete(':id')
  @AuthRoles('admin')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.postService.remove(Number(id));
    return { message: '文章删除成功' };
  }
}

