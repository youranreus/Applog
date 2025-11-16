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
  Ip,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import {
  CreateCommentDto,
  UpdateCommentDto,
  QueryCommentDto,
  ReactCommentDto,
  ApproveCommentDto,
} from './dto';
import type { ICommentResponseDto } from './dto';
import type { Pagination } from 'nestjs-typeorm-paginate';

@Controller({
  path: 'comment',
  version: [VERSION_NEUTRAL, '1'],
})
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  /**
   * 创建评论（公开接口）
   * @param createDto 创建评论的数据
   * @param user 当前登录用户（可选）
   * @returns 创建后的评论信息
   */
  @Post()
  async create(
    @Body() createDto: CreateCommentDto,
    @UserParams() user: UserJwtPayload,
    @Ip() ip?: string,
  ): Promise<ICommentResponseDto> {
    createDto.ip = ip || createDto.ip;
    return this.commentService.create(createDto, user?.id, ip);
  }

  /**
   * 查询评论列表（公开接口）
   * @param queryDto 查询参数
   * @returns 分页的评论列表（嵌套回复结构）
   */
  @Get()
  async findAll(
    @Query() queryDto: QueryCommentDto,
  ): Promise<Pagination<ICommentResponseDto>> {
    return this.commentService.findAll(queryDto);
  }

  /**
   * 查询单条评论详情（公开接口）
   * @param id 评论ID
   * @returns 评论详情（包含嵌套回复）
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ICommentResponseDto> {
    return this.commentService.findOne(Number(id));
  }

  /**
   * 更新评论（需要 admin 权限）
   * @param id 评论ID
   * @param updateDto 更新数据
   * @returns 更新后的评论信息
   */
  @Patch(':id')
  @AuthRoles('admin')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateCommentDto,
  ): Promise<ICommentResponseDto> {
    return this.commentService.update(Number(id), updateDto);
  }

  /**
   * 删除评论（需要 admin 权限）
   * @param id 评论ID
   * @returns 删除成功的消息
   */
  @Delete(':id')
  @AuthRoles('admin')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.commentService.remove(Number(id));
    return { message: '评论删除成功' };
  }

  /**
   * 点赞评论（公开接口）
   * @param id 评论ID
   * @param reactDto 反应数据（已简化，不需要字段）
   * @param user 当前用户（可选，已不需要记录用户关系）
   * @returns 更新后的评论信息
   */
  @Post(':id/react')
  async react(
    @Param('id') id: string,
    @Body() reactDto: ReactCommentDto,
    @UserParams() user?: UserJwtPayload,
  ): Promise<ICommentResponseDto> {
    return this.commentService.react(Number(id), reactDto, user?.id);
  }

  /**
   * 审核评论（需要 admin 权限）
   * @param id 评论ID
   * @param approveDto 审核数据
   * @returns 审核后的评论信息
   */
  @Post(':id/approve')
  @AuthRoles('admin')
  async approve(
    @Param('id') id: string,
    @Body() approveDto: ApproveCommentDto,
  ): Promise<ICommentResponseDto> {
    return this.commentService.approve(Number(id), approveDto);
  }
}
