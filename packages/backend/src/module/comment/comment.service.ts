import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import { CommentEntity, PostEntity } from '@/entities';
import { isNil } from 'lodash';
import type {
  CreateCommentDto,
  UpdateCommentDto,
  QueryCommentDto,
  ICommentResponseDto,
  ReactCommentDto,
  ApproveCommentDto,
} from './dto';
import {
  paginate,
  Pagination,
  IPaginationOptions,
} from 'nestjs-typeorm-paginate';

@Injectable()
export class CommentService {
  @InjectRepository(CommentEntity)
  private commentRepo: Repository<CommentEntity>;

  @InjectRepository(PostEntity)
  private postRepo: Repository<PostEntity>;

  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  constructor(private config: ConfigService) {}

  private log(message: string) {
    this.logger.log(message, CommentService.name);
  }

  private warn(message: string) {
    this.logger.warn(message, CommentService.name);
  }

  private error(message: string) {
    this.logger.error(message, CommentService.name);
  }

  /**
   * 创建评论
   * @param createData 创建评论的数据
   * @param userId 当前用户的数据库 ID（可选，如果未登录则可能需要默认用户）
   * @returns 创建后的评论信息
   *
   * 逻辑说明：
   * 1. 检查文章是否存在
   * 2. 如果提供了 parentId，检查父评论是否存在且属于同一文章
   * 3. 创建评论实体，默认状态为 'pending'
   * 4. 保存评论到数据库
   * 5. 返回评论数据
   */
  async create(
    createData: CreateCommentDto,
    userId?: number,
  ): Promise<ICommentResponseDto> {
    this.log(
      `开始创建评论，文章ID: ${createData.postId}，父评论ID: ${createData.parentId || '无'}`,
    );

    try {
      // 检查文章是否存在
      const post = await this.postRepo.findOne({
        where: { id: createData.postId },
      });

      if (isNil(post)) {
        this.warn(`文章 #${createData.postId} 不存在`);
        throw new BusinessException('文章不存在');
      }

      // 如果提供了 parentId，检查父评论是否存在且属于同一文章
      if (createData.parentId) {
        const parentComment = await this.commentRepo.findOne({
          where: { id: createData.parentId },
        });

        if (isNil(parentComment)) {
          this.warn(`父评论 #${createData.parentId} 不存在`);
          throw new BusinessException('父评论不存在');
        }

        if (parentComment.postId !== createData.postId) {
          this.warn(
            `父评论 #${createData.parentId} 不属于文章 #${createData.postId}`,
          );
          throw new BusinessException('父评论不属于该文章');
        }
      }

      // 如果没有提供 userId，使用默认的匿名用户ID（需要配置）
      const authorId =
        userId || this.config.get<number>('ANONYMOUS_USER_ID', 1);

      // 创建评论实体
      const comment = this.commentRepo.create({
        content: createData.content,
        postId: createData.postId,
        parentId: createData.parentId,
        authorId,
        status: 'pending',
        likeCount: 0,
      });

      // 保存到数据库
      const savedComment = await this.commentRepo.save(comment);
      this.log(
        `评论创建成功，评论ID: ${savedComment.id}，文章ID: ${createData.postId}，状态: pending`,
      );

      // 查询包含作者信息的评论
      const commentWithAuthor = await this.commentRepo.findOne({
        where: { id: savedComment.id },
        relations: ['author'],
      });

      return this.formatCommentResponse(commentWithAuthor!);
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`创建评论失败: ${error.message}`);
      throw new BusinessException('创建评论失败，请稍后重试');
    }
  }

  /**
   * 查询评论列表（支持分页、筛选、嵌套回复结构）
   * @param queryDto 查询参数
   * @returns 分页的评论列表（嵌套回复结构）
   *
   * 逻辑说明：
   * 1. 构建查询条件（postId、status）
   * 2. 执行分页查询，只查询顶级评论（parentId 为 null）
   * 3. 对于每条顶级评论，递归查询其所有子评论
   * 4. 构建嵌套回复的树形结构
   * 5. 返回格式化后的评论列表
   */
  async findAll(
    queryDto: QueryCommentDto,
  ): Promise<Pagination<ICommentResponseDto>> {
    const { page = 1, limit = 10, postId, status } = queryDto;

    this.log(
      `查询评论列表，页码: ${page}，每页: ${limit}，文章ID: ${postId || '全部'}，状态: ${status || '全部'}`,
    );

    try {
      // 创建查询构建器，只查询顶级评论（parentId 为 null）
      const queryBuilder = this.commentRepo
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.author', 'author')
        .where('comment.parentId IS NULL');

      // 按文章ID筛选
      if (postId) {
        queryBuilder.andWhere('comment.postId = :postId', { postId });
      }

      // 按状态筛选（如果提供）
      if (status) {
        queryBuilder.andWhere('comment.status = :status', { status });
      }

      // 按创建时间倒序排列
      queryBuilder.orderBy('comment.createdAt', 'DESC');

      // 分页配置
      const options: IPaginationOptions = {
        page,
        limit,
      };

      // 执行分页查询
      const paginationResult = await paginate<CommentEntity>(
        queryBuilder,
        options,
      );

      // 查询所有顶级评论的ID
      const topLevelIds = paginationResult.items.map((item) => item.id);

      // 如果有关联的顶级评论，查询所有子评论
      let allComments: CommentEntity[] = [...paginationResult.items];
      if (topLevelIds.length > 0) {
        // 递归查询所有子评论
        const allChildren = await this.findAllChildren(topLevelIds);
        allComments = [...paginationResult.items, ...allChildren];

        // 查询子评论的作者信息
        const childrenWithAuthors = await this.commentRepo.find({
          where: { id: In(allChildren.map((c) => c.id)) },
          relations: ['author'],
        });

        // 合并作者信息
        const authorMap = new Map(
          childrenWithAuthors.map((c) => [c.id, c.author]),
        );
        allComments.forEach((comment) => {
          if (authorMap.has(comment.id)) {
            comment.author = authorMap.get(comment.id);
          }
        });
      }

      // 为顶级评论加载作者信息（如果没有）
      const topLevelWithAuthors = await this.commentRepo.find({
        where: { id: In(paginationResult.items.map((i) => i.id)) },
        relations: ['author'],
      });

      const topLevelAuthorMap = new Map(
        topLevelWithAuthors.map((c) => [c.id, c.author]),
      );
      paginationResult.items.forEach((item) => {
        if (topLevelAuthorMap.has(item.id)) {
          item.author = topLevelAuthorMap.get(item.id);
        }
      });

      // 构建嵌套回复的树形结构
      const commentTree = this.buildCommentTree(allComments);

      this.log(
        `评论列表查询成功，共 ${paginationResult.meta.totalItems} 条顶级评论，返回第 ${page} 页 ${commentTree.length} 条`,
      );

      return {
        items: commentTree,
        meta: paginationResult.meta,
        links: paginationResult.links,
      };
    } catch (error) {
      this.error(`查询评论列表失败: ${error.message}`);
      throw new BusinessException('查询评论列表失败，请稍后重试');
    }
  }

  /**
   * 查询单条评论详情
   * @param id 评论ID
   * @returns 评论详情（包含作者信息和回复列表）
   *
   * 逻辑说明：
   * 1. 查询评论是否存在
   * 2. 加载作者信息
   * 3. 查询所有直接子评论（一级回复）
   * 4. 构建嵌套回复结构
   * 5. 返回格式化后的评论详情
   */
  async findOne(id: number): Promise<ICommentResponseDto> {
    this.log(`查询评论详情，评论ID: ${id}`);

    try {
      // 查询评论及其作者
      const comment = await this.commentRepo.findOne({
        where: { id },
        relations: ['author'],
      });

      if (isNil(comment)) {
        this.warn(`评论 #${id} 不存在`);
        throw new BusinessException('评论不存在');
      }

      // 查询所有子评论（递归）
      const allChildren = await this.findAllChildren([id]);
      const allComments = [comment, ...allChildren];

      // 为子评论加载作者信息
      if (allChildren.length > 0) {
        const childrenWithAuthors = await this.commentRepo.find({
          where: { id: In(allChildren.map((c) => c.id)) },
          relations: ['author'],
        });

        const authorMap = new Map(
          childrenWithAuthors.map((c) => [c.id, c.author]),
        );
        allComments.forEach((c) => {
          if (authorMap.has(c.id)) {
            c.author = authorMap.get(c.id);
          }
        });
      }

      // 构建嵌套回复结构
      const commentTree = this.buildCommentTree(allComments);
      const result = commentTree.find((c) => c.id === id);

      if (!result) {
        throw new BusinessException('构建评论树失败');
      }

      this.log(`评论详情查询成功，评论ID: ${id}`);
      return result;
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`查询评论详情失败: ${error.message}`);
      throw new BusinessException('查询评论详情失败，请稍后重试');
    }
  }

  /**
   * 更新评论内容
   * @param id 评论ID
   * @param updateData 更新数据
   * @returns 更新后的评论信息
   *
   * 逻辑说明：
   * 1. 查询评论是否存在
   * 2. 更新评论内容
   * 3. 保存更新后的评论
   * 4. 返回更新后的评论数据
   */
  async update(
    id: number,
    updateData: UpdateCommentDto,
  ): Promise<ICommentResponseDto> {
    this.log(`开始更新评论，评论ID: ${id}`);

    try {
      // 查询评论是否存在
      const comment = await this.commentRepo.findOne({ where: { id } });

      if (isNil(comment)) {
        this.warn(`评论 #${id} 不存在`);
        throw new BusinessException('评论不存在');
      }

      // 更新评论内容
      comment.content = updateData.content;
      this.log(`更新评论 #${id} 内容`);

      // 保存更新
      const savedComment = await this.commentRepo.save(comment);
      this.log(`评论 #${id} 更新成功`);

      // 查询包含作者信息的评论
      const commentWithAuthor = await this.commentRepo.findOne({
        where: { id: savedComment.id },
        relations: ['author'],
      });

      return this.formatCommentResponse(commentWithAuthor!);
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`更新评论失败: ${error.message}`);
      throw new BusinessException('更新评论失败，请稍后重试');
    }
  }

  /**
   * 删除评论
   * @param id 评论ID
   *
   * 逻辑说明：
   * 1. 查询评论是否存在
   * 2. 递归查询所有子评论
   * 3. 级联删除所有子评论
   * 4. 删除当前评论
   */
  async remove(id: number): Promise<void> {
    this.log(`开始删除评论，评论ID: ${id}`);

    try {
      // 查询评论是否存在
      const comment = await this.commentRepo.findOne({ where: { id } });

      if (isNil(comment)) {
        this.warn(`评论 #${id} 不存在`);
        throw new BusinessException('评论不存在');
      }

      // 递归查询所有子评论
      const allChildren = await this.findAllChildren([id]);
      const allCommentIds = [id, ...allChildren.map((c) => c.id)];

      // 删除所有评论（包括子评论）
      await this.commentRepo.delete({ id: In(allCommentIds) });
      this.log(`评论 #${id} 及其 ${allChildren.length} 条子评论删除成功`);
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`删除评论失败: ${error.message}`);
      throw new BusinessException('删除评论失败，请稍后重试');
    }
  }

  /**
   * 点赞评论
   * @param commentId 评论ID
   * @param reactData 反应数据（占位符，已简化不需要字段）
   * @param userId 用户ID（可选，已不需要记录用户关系）
   * @returns 更新后的评论信息
   *
   * 逻辑说明：
   * 1. 检查评论是否存在
   * 2. 直接增加点赞计数
   * 3. 保存更新后的评论
   * 4. 返回更新后的评论数据
   */
  async react(
    commentId: number,
    reactData: ReactCommentDto,
    userId?: number,
  ): Promise<ICommentResponseDto> {
    this.log(`开始点赞评论，评论ID: ${commentId}`);

    try {
      // 检查评论是否存在
      const comment = await this.commentRepo.findOne({
        where: { id: commentId },
      });

      if (isNil(comment)) {
        this.warn(`评论 #${commentId} 不存在`);
        throw new BusinessException('评论不存在');
      }

      // 直接增加点赞计数
      comment.likeCount = comment.likeCount + 1;
      const updatedComment = await this.commentRepo.save(comment);

      this.log(
        `评论 #${commentId} 点赞成功，当前点赞数: ${updatedComment.likeCount}`,
      );

      // 查询包含作者信息的评论
      const commentWithAuthor = await this.commentRepo.findOne({
        where: { id: updatedComment.id },
        relations: ['author'],
      });

      return this.formatCommentResponse(commentWithAuthor!);
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`点赞评论失败: ${error.message}`);
      throw new BusinessException('点赞评论失败，请稍后重试');
    }
  }

  /**
   * 审核评论
   * @param id 评论ID
   * @param approveData 审核数据
   * @returns 审核后的评论信息
   *
   * 逻辑说明：
   * 1. 查询评论是否存在
   * 2. 更新评论状态为 approved 或 rejected
   * 3. 保存更新后的评论
   * 4. 返回更新后的评论数据
   */
  async approve(
    id: number,
    approveData: ApproveCommentDto,
  ): Promise<ICommentResponseDto> {
    this.log(
      `开始审核评论，评论ID: ${id}，审核状态: ${approveData.status}`,
    );

    try {
      // 查询评论是否存在
      const comment = await this.commentRepo.findOne({ where: { id } });

      if (isNil(comment)) {
        this.warn(`评论 #${id} 不存在`);
        throw new BusinessException('评论不存在');
      }

      // 更新评论状态
      comment.status = approveData.status;
      this.log(`更新评论 #${id} 状态: ${approveData.status}`);

      // 保存更新
      const savedComment = await this.commentRepo.save(comment);
      this.log(`评论 #${id} 审核成功`);

      // 查询包含作者信息的评论
      const commentWithAuthor = await this.commentRepo.findOne({
        where: { id: savedComment.id },
        relations: ['author'],
      });

      return this.formatCommentResponse(commentWithAuthor!);
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`审核评论失败: ${error.message}`);
      throw new BusinessException('审核评论失败，请稍后重试');
    }
  }

  /**
   * 递归查询所有子评论
   * @param parentIds 父评论ID数组
   * @returns 所有子评论数组
   *
   * 逻辑说明：
   * 1. 查询所有直接子评论
   * 2. 如果有子评论，递归查询子评论的子评论
   * 3. 返回所有层级的子评论
   */
  private async findAllChildren(
    parentIds: number[],
  ): Promise<CommentEntity[]> {
    if (parentIds.length === 0) {
      return [];
    }

    // 查询直接子评论
    const children = await this.commentRepo.find({
      where: { parentId: In(parentIds) },
    });

    // 如果有子评论，递归查询
    if (children.length > 0) {
      const childrenIds = children.map((c) => c.id);
      const grandchildren = await this.findAllChildren(childrenIds);
      return [...children, ...grandchildren];
    }

    return children;
  }

  /**
   * 构建嵌套回复的树形结构
   * @param comments 所有评论数组（包括顶级和子评论）
   * @returns 嵌套的评论树
   *
   * 逻辑说明：
   * 1. 筛选出所有顶级评论（parentId 为 null 或 undefined）
   * 2. 为每个顶级评论递归查找其子评论
   * 3. 构建嵌套的树形结构
   */
  private buildCommentTree(
    comments: CommentEntity[],
  ): ICommentResponseDto[] {
    // 创建评论映射
    const commentMap = new Map<number, CommentEntity>();
    comments.forEach((comment) => {
      commentMap.set(comment.id, comment);
    });

    // 创建子评论映射
    const childrenMap = new Map<number, CommentEntity[]>();
    comments.forEach((comment) => {
      if (comment.parentId) {
        if (!childrenMap.has(comment.parentId)) {
          childrenMap.set(comment.parentId, []);
        }
        childrenMap.get(comment.parentId)!.push(comment);
      }
    });

    // 递归构建评论树
    const buildTree = (comment: CommentEntity): ICommentResponseDto => {
      const response = this.formatCommentResponse(comment);
      const children = childrenMap.get(comment.id) || [];

      if (children.length > 0) {
        response.replies = children
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((child) => buildTree(child));
      }

      return response;
    };

    // 筛选顶级评论并按创建时间排序
    const topLevelComments = comments
      .filter((comment) => !comment.parentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return topLevelComments.map((comment) => buildTree(comment));
  }

  /**
   * 格式化评论响应
   * @param comment 评论实体
   * @returns 格式化后的评论响应
   */
  private formatCommentResponse(comment: CommentEntity): ICommentResponseDto {
    const data = comment.getData(true);

    return {
      ...data,
      replies: undefined, // 由 buildCommentTree 方法填充
    };
  }

  /**
   * 统计文章的评论数量
   * @param postId 文章ID
   * @returns 评论数量
   *
   * 逻辑说明：
   * 1. 查询该文章下的所有评论数量
   * 2. 返回统计结果
   */
  async countByPostId(postId: number): Promise<number> {
    return await this.commentRepo.count({
      where: { postId },
    });
  }
}

