import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Patch,
  Param,
  Post,
  Query,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import type { Pagination } from 'nestjs-typeorm-paginate';
import { CommentService } from './comment.service';
import {
  AdminQueryCommentDto,
  ApproveCommentDto,
  CreateCommentDto,
  ResolvePendingCommentsDto,
  CommentLocationQueryDto,
  WithdrawCommentDto,
  QueryCommentDto,
  UpdateCommentDto,
} from './dto';
import type {
  IAdminCommentDto,
  ICreateCommentResponseDto,
  ICommentLocationDto,
  IDeleteImpactDto,
  IPublicCommentDto,
} from './dto';

@Controller({ path: 'comment', version: [VERSION_NEUTRAL, '1'] })
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  create(
    @Body() dto: CreateCommentDto,
    @UserParams() user: UserJwtPayload | undefined,
    @Ip() ip: string,
    @Headers('user-agent') agent?: string,
  ): Promise<ICreateCommentResponseDto> {
    return this.commentService.create(dto, user, { ip, agent });
  }

  @Get()
  findAll(
    @Query() dto: QueryCommentDto,
  ): Promise<Pagination<IPublicCommentDto>> {
    return this.commentService.findAll(dto);
  }

  @Post('pending/resolve')
  resolvePending(
    @Body() dto: ResolvePendingCommentsDto,
  ): Promise<IPublicCommentDto[]> {
    return this.commentService.resolvePending(dto.capabilities);
  }

  @Get('admin')
  @AuthRoles('admin')
  findAdmin(
    @Query() dto: AdminQueryCommentDto,
  ): Promise<Pagination<IAdminCommentDto>> {
    return this.commentService.findAdmin(dto);
  }

  @Get('admin/:id/delete-impact')
  @AuthRoles('admin')
  getDeleteImpact(@Param('id') id: string): Promise<IDeleteImpactDto> {
    return this.commentService.getDeleteImpact(Number(id));
  }

  @Post(':id/withdraw')
  withdraw(
    @Param('id') id: string,
    @Body() dto: WithdrawCommentDto,
  ): Promise<{ deleted: boolean }> {
    return this.commentService.withdraw(Number(id), dto.token);
  }

  @Post(':id/approve')
  @AuthRoles('admin')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveCommentDto,
  ): Promise<IAdminCommentDto> {
    return this.commentService.approve(Number(id), dto);
  }

  @Patch(':id')
  @AuthRoles('admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<IAdminCommentDto> {
    return this.commentService.update(Number(id), dto.content);
  }

  @Post(':id/react')
  react(@Param('id') id: string): Promise<IPublicCommentDto> {
    return this.commentService.react(Number(id));
  }

  @Get(':id/location')
  findLocation(
    @Param('id') id: string,
    @Query() dto: CommentLocationQueryDto,
  ): Promise<ICommentLocationDto> {
    return this.commentService.findLocation(Number(id), dto.limit);
  }

  @Delete(':id')
  @AuthRoles('admin')
  remove(@Param('id') id: string): Promise<{ deletedCount: number }> {
    return this.commentService.remove(Number(id));
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<IPublicCommentDto> {
    return this.commentService.findOne(Number(id));
  }
}
