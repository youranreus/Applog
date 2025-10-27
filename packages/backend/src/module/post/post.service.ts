import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import { PostEntity, CommentEntity } from '@/entities';
import type {
  CreatePostDto,
  IPostResponseDto,
  QueryPostDto,
  IPostListItemDto,
} from './dto';
import { isNil } from 'lodash';
import {
  paginate,
  Pagination,
  IPaginationOptions,
} from 'nestjs-typeorm-paginate';

@Injectable()
export class PostService {
  @InjectRepository(PostEntity)
  private postRepo: Repository<PostEntity>;

  @InjectRepository(CommentEntity)
  private commentRepo: Repository<CommentEntity>;

  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  constructor(private config: ConfigService) {}

  private log(message: string) {
    this.logger.log(message, PostService.name);
  }

  private warn(message: string) {
    this.logger.warn(message, PostService.name);
  }

  private error(message: string) {
    this.logger.error(message, PostService.name);
  }

  /**
   * 创建文章
   * @param createData 创建文章的数据
   * @param userId 当前用户的 ssoId
   * @returns 创建后的文章信息
   */
  async create(
    createData: CreatePostDto,
    userId: number,
  ): Promise<IPostResponseDto> {
    this.log(`管理员 #${userId} 开始创建文章，标题: ${createData.title}`);

    try {
      // 创建文章实体
      const post = this.postRepo.create({
        title: createData.title,
        content: createData.content,
        summary: createData.summary,
        cover: createData.cover,
        status: createData.status || 'draft',
        tags: createData.tags,
        extra: createData.extra,
        authorId: userId,
      });

      // 保存到数据库
      const savedPost = await this.postRepo.save(post);
      this.log(
        `文章创建成功，文章ID: ${savedPost.id}，作者: ${userId}，状态: ${savedPost.status}`,
      );

      return savedPost.getData();
    } catch (error) {
      this.error(`创建文章失败: ${error.message}`);
      throw new BusinessException('创建文章失败，请稍后重试');
    }
  }

  /**
   * 获取文章列表（分页、搜索、筛选）
   * @param queryDto 查询参数
   * @returns 分页的文章列表
   */
  async findAll(
    queryDto: QueryPostDto,
  ): Promise<Pagination<IPostListItemDto>> {
    const { page = 1, limit = 10, keyword, tags } = queryDto;

    this.log(
      `查询文章列表，页码: ${page}，每页: ${limit}，关键字: ${keyword || '无'}，标签: ${tags?.join(',') || '无'}`,
    );

    try {
      // 创建查询构建器
      const queryBuilder = this.postRepo
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.author', 'author')
        .select([
          'post.id',
          'post.title',
          'post.summary',
          'post.cover',
          'post.status',
          'post.viewCount',
          'post.authorId',
          'post.tags',
          'post.createdAt',
          'post.updatedAt',
          'author.ssoId',
          'author.name',
          'author.avatar',
        ]);

      // 关键字搜索（模糊匹配标题和摘要）
      if (keyword) {
        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where('post.title LIKE :keyword', {
              keyword: `%${keyword}%`,
            }).orWhere('post.summary LIKE :keyword', {
              keyword: `%${keyword}%`,
            });
          }),
        );
        this.log(`应用关键字搜索: ${keyword}`);
      }

      // 标签筛选
      if (tags && tags.length > 0) {
        queryBuilder.andWhere(
          new Brackets((qb) => {
            tags.forEach((tag, index) => {
              if (index === 0) {
                qb.where('post.tags LIKE :tag0', { tag0: `%${tag}%` });
              } else {
                qb.orWhere(`post.tags LIKE :tag${index}`, {
                  [`tag${index}`]: `%${tag}%`,
                });
              }
            });
          }),
        );
        this.log(`应用标签筛选: ${tags.join(', ')}`);
      }

      // 按创建时间倒序排列
      queryBuilder.orderBy('post.createdAt', 'DESC');

      // 分页配置
      const options: IPaginationOptions = {
        page,
        limit,
      };

      // 执行分页查询
      const paginationResult = await paginate<PostEntity>(
        queryBuilder,
        options,
      );

      // 转换为列表项 DTO
      const items: IPostListItemDto[] = paginationResult.items.map((post) => ({
        id: post.id,
        title: post.title,
        summary: post.summary,
        cover: post.cover,
        status: post.status,
        viewCount: post.viewCount,
        authorId: post.authorId,
        author: post.author
          ? {
              id: post.author.ssoId,
              name: post.author.name,
              avatar: post.author.avatar,
            }
          : undefined,
        tags: post.tags,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      }));

      this.log(
        `文章列表查询成功，共 ${paginationResult.meta.totalItems} 条，返回第 ${page} 页 ${items.length} 条`,
      );

      return {
        items,
        meta: paginationResult.meta,
        links: paginationResult.links,
      };
    } catch (error) {
      this.error(`查询文章列表失败: ${error.message}`);
      throw new BusinessException('查询文章列表失败，请稍后重试');
    }
  }

  /**
   * 删除文章
   * @param id 文章ID
   */
  async remove(id: number): Promise<void> {
    this.log(`开始删除文章，文章ID: ${id}`);

    try {
      // 检查文章是否存在
      const post = await this.postRepo.findOne({ where: { id } });

      if (isNil(post)) {
        this.warn(`文章 #${id} 不存在`);
        throw new BusinessException('文章不存在');
      }

      // 检查文章是否有评论
      const commentCount = await this.commentRepo.count({
        where: { postId: id },
      });

      if (commentCount > 0) {
        this.warn(
          `文章 #${id} 存在 ${commentCount} 条评论，无法删除`,
        );
        throw new BusinessException(
          `该文章存在 ${commentCount} 条评论，无法删除`,
        );
      }

      // 删除文章
      await this.postRepo.remove(post);
      this.log(`文章 #${id} 删除成功`);
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`删除文章失败: ${error.message}`);
      throw new BusinessException('删除文章失败，请稍后重试');
    }
  }
}

