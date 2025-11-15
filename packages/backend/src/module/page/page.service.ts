import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import { PageEntity } from '@/entities';
import type {
  CreatePageDto,
  UpdatePageDto,
  IPageResponseDto,
  QueryPageDto,
  IPageListItemDto,
  IPageNavItemDto,
} from './dto';
import { isNil } from 'lodash';
import {
  paginate,
  Pagination,
  IPaginationOptions,
} from 'nestjs-typeorm-paginate';

@Injectable()
export class PageService {
  @InjectRepository(PageEntity)
  private pageRepo: Repository<PageEntity>;

  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  constructor(private config: ConfigService) {}

  private log(message: string) {
    this.logger.log(message, PageService.name);
  }

  private warn(message: string) {
    this.logger.warn(message, PageService.name);
  }

  private error(message: string) {
    this.logger.error(message, PageService.name);
  }

  /**
   * 创建页面
   * @param createData 创建页面的数据
   * @param userId 当前用户的数据库 ID（来自 JWT）
   * @returns 创建后的页面信息
   *
   * 逻辑说明：
   * 1. 检查slug是否已存在
   * 2. 使用 JWT 中的用户数据库 ID 作为 authorId
   * 3. 创建页面实体
   * 4. 保存页面到数据库
   * 5. 返回页面数据
   */
  async create(
    createData: CreatePageDto,
    userId: number,
  ): Promise<IPageResponseDto> {
    this.log(`用户 #${userId} 开始创建页面，标题: ${createData.title}`);

    try {
      // 检查slug是否已存在
      const existingPage = await this.pageRepo.findOne({
        where: { slug: createData.slug },
      });

      if (!isNil(existingPage)) {
        this.warn(`页面slug "${createData.slug}" 已存在`);
        throw new BusinessException('页面slug已存在，请使用其他slug');
      }

      // 创建页面实体，直接使用 JWT 中的用户数据库 ID
      const page = this.pageRepo.create({
        title: createData.title,
        content: createData.content,
        summary: createData.summary,
        cover: createData.cover,
        slug: createData.slug,
        status: createData.status || 'draft',
        showInNav: createData.showInNav ?? false,
        showInFooter: createData.showInFooter ?? false,
        tags: createData.tags,
        extra: createData.extra,
        authorId: userId,
      });

      // 保存到数据库
      const savedPage = await this.pageRepo.save(page);
      this.log(
        `页面创建成功，页面ID: ${savedPage.id}，作者: ${userId}，状态: ${savedPage.status}，slug: ${savedPage.slug}`,
      );

      return savedPage.getData();
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`创建页面失败: ${error.message}`);
      throw new BusinessException('创建页面失败，请稍后重试');
    }
  }

  /**
   * 更新页面
   * @param id 页面ID
   * @param updateData 更新数据
   * @returns 更新后的页面信息
   *
   * 逻辑说明：
   * 1. 查询页面是否存在
   * 2. 如果更新slug，检查新slug是否已被其他页面使用
   * 3. 逐个更新提供的字段（只更新传入的字段）
   * 4. 保存更新后的页面
   * 5. 返回更新后的页面数据
   */
  async update(
    id: number,
    updateData: UpdatePageDto,
  ): Promise<IPageResponseDto> {
    this.log(`开始更新页面 #${id}`);

    try {
      // 查询页面是否存在
      const page = await this.pageRepo.findOne({ where: { id } });

      if (isNil(page)) {
        this.warn(`页面 #${id} 不存在`);
        throw new BusinessException('页面不存在');
      }

      // 如果更新slug，检查新slug是否已被其他页面使用
      if (updateData.slug !== undefined && updateData.slug !== page.slug) {
        const existingPage = await this.pageRepo.findOne({
          where: { slug: updateData.slug },
        });

        if (!isNil(existingPage)) {
          this.warn(`页面slug "${updateData.slug}" 已被其他页面使用`);
          throw new BusinessException('页面slug已被使用，请使用其他slug');
        }
      }

      // 逐个更新提供的字段（局部更新）
      if (updateData.title !== undefined) {
        page.title = updateData.title;
        this.log(`更新页面 #${id} 标题: ${updateData.title}`);
      }

      if (updateData.content !== undefined) {
        page.content = updateData.content;
        this.log(`更新页面 #${id} 内容`);
      }

      if (updateData.summary !== undefined) {
        page.summary = updateData.summary;
        this.log(`更新页面 #${id} 摘要`);
      }

      if (updateData.cover !== undefined) {
        page.cover = updateData.cover;
        this.log(`更新页面 #${id} 封面`);
      }

      if (updateData.slug !== undefined) {
        page.slug = updateData.slug;
        this.log(`更新页面 #${id} slug: ${updateData.slug}`);
      }

      if (updateData.status !== undefined) {
        page.status = updateData.status;
        this.log(`更新页面 #${id} 状态: ${updateData.status}`);
      }

      if (updateData.showInNav !== undefined) {
        page.showInNav = updateData.showInNav;
        this.log(`更新页面 #${id} showInNav: ${updateData.showInNav}`);
      }

      if (updateData.showInFooter !== undefined) {
        page.showInFooter = updateData.showInFooter;
        this.log(`更新页面 #${id} showInFooter: ${updateData.showInFooter}`);
      }

      if (updateData.tags !== undefined) {
        page.tags = updateData.tags;
        this.log(`更新页面 #${id} 标签: ${updateData.tags.join(', ')}`);
      }

      if (updateData.extra !== undefined) {
        page.extra = updateData.extra;
        this.log(`更新页面 #${id} 额外数据`);
      }

      // 保存更新
      const savedPage = await this.pageRepo.save(page);
      this.log(`页面 #${id} 更新成功`);

      return savedPage.getData();
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`更新页面失败: ${error.message}`);
      throw new BusinessException('更新页面失败，请稍后重试');
    }
  }

  /**
   * 获取页面列表（分页、搜索、筛选）
   * @param queryDto 查询参数
   * @returns 分页的页面列表
   */
  async findAll(queryDto: QueryPageDto): Promise<Pagination<IPageListItemDto>> {
    const { page = 1, limit = 10, keyword, tags } = queryDto;

    this.log(
      `查询页面列表，页码: ${page}，每页: ${limit}，关键字: ${keyword || '无'}，标签: ${tags?.join(',') || '无'}`,
    );

    try {
      // 创建查询构建器
      const queryBuilder = this.pageRepo
        .createQueryBuilder('page')
        .leftJoinAndSelect('page.author', 'author')
        .select([
          'page.id',
          'page.title',
          'page.summary',
          'page.cover',
          'page.slug',
          'page.status',
          'page.viewCount',
          'page.showInNav',
          'page.showInFooter',
          'page.authorId',
          'page.tags',
          'page.createdAt',
          'page.updatedAt',
          'author.ssoId',
          'author.name',
          'author.avatar',
        ]);

      // 关键字搜索（模糊匹配标题和摘要）
      if (keyword) {
        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where('page.title LIKE :keyword', {
              keyword: `%${keyword}%`,
            }).orWhere('page.summary LIKE :keyword', {
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
                qb.where('page.tags LIKE :tag0', { tag0: `%${tag}%` });
              } else {
                qb.orWhere(`page.tags LIKE :tag${index}`, {
                  [`tag${index}`]: `%${tag}%`,
                });
              }
            });
          }),
        );
        this.log(`应用标签筛选: ${tags.join(', ')}`);
      }

      // 按创建时间倒序排列
      queryBuilder.orderBy('page.createdAt', 'DESC');

      // 分页配置
      const options: IPaginationOptions = {
        page,
        limit,
      };

      // 执行分页查询
      const paginationResult = await paginate<PageEntity>(
        queryBuilder,
        options,
      );

      // 转换为列表项 DTO
      const items: IPageListItemDto[] = paginationResult.items.map((page) => ({
        id: page.id,
        title: page.title,
        summary: page.summary,
        cover: page.cover,
        slug: page.slug,
        status: page.status,
        viewCount: page.viewCount,
        showInNav: page.showInNav,
        showInFooter: page.showInFooter,
        authorId: page.authorId,
        author: page.author
          ? {
              id: page.author.ssoId,
              name: page.author.name,
              avatar: page.author.avatar,
            }
          : undefined,
        tags: page.tags,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      }));

      this.log(
        `页面列表查询成功，共 ${paginationResult.meta.totalItems} 条，返回第 ${page} 页 ${items.length} 条`,
      );

      return {
        items,
        meta: paginationResult.meta,
        links: paginationResult.links,
      };
    } catch (error) {
      this.error(`查询页面列表失败: ${error.message}`);
      throw new BusinessException('查询页面列表失败，请稍后重试');
    }
  }

  /**
   * 通过ID获取单个页面详情
   * @param id 页面ID
   * @param includeAuthor 是否包含作者信息
   * @returns 页面详情
   */
  async findOne(id: number, includeAuthor = false): Promise<IPageResponseDto> {
    this.log(`查询页面详情，页面ID: ${id}`);

    try {
      const page = await this.pageRepo.findOne({
        where: { id },
        relations: includeAuthor ? ['author'] : [],
      });

      if (isNil(page)) {
        this.warn(`页面 #${id} 不存在`);
        throw new BusinessException('页面不存在');
      }

      // 增加浏览次数
      page.viewCount += 1;
      await this.pageRepo.save(page);

      this.log(`页面 #${id} 查询成功，浏览次数: ${page.viewCount}`);

      return page.getData(includeAuthor);
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`查询页面详情失败: ${error.message}`);
      throw new BusinessException('查询页面详情失败，请稍后重试');
    }
  }

  /**
   * 通过slug获取单个页面详情
   * @param slug 页面slug
   * @param includeAuthor 是否包含作者信息
   * @returns 页面详情
   */
  async findBySlug(
    slug: string,
    includeAuthor = false,
  ): Promise<IPageResponseDto> {
    this.log(`查询页面详情，页面slug: ${slug}`);

    try {
      const page = await this.pageRepo.findOne({
        where: { slug },
        relations: includeAuthor ? ['author'] : [],
      });

      if (isNil(page)) {
        this.warn(`页面slug "${slug}" 不存在`);
        throw new BusinessException('页面不存在');
      }

      // 只对已发布的页面增加浏览次数
      if (page.status === 'published') {
        page.viewCount += 1;
        await this.pageRepo.save(page);
      }

      this.log(`页面slug "${slug}" 查询成功，浏览次数: ${page.viewCount}`);

      return page.getData(includeAuthor);
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`查询页面详情失败: ${error.message}`);
      throw new BusinessException('查询页面详情失败，请稍后重试');
    }
  }

  /**
   * 获取所有设置了 showInNav 或 showInFooter 的页面
   * 用于导航栏和footer展示
   * @returns 导航/Footer页面列表
   */
  async findNavPages(): Promise<IPageNavItemDto[]> {
    this.log('查询导航和Footer页面列表');

    try {
      // 查询所有已发布且设置了 showInNav 或 showInFooter 的页面
      const pages = await this.pageRepo
        .createQueryBuilder('page')
        .select([
          'page.id',
          'page.title',
          'page.slug',
          'page.showInNav',
          'page.showInFooter',
        ])
        .where('page.status = :status', { status: 'published' })
        .andWhere(
          new Brackets((qb) => {
            qb.where('page.showInNav = :showInNav', {
              showInNav: true,
            }).orWhere('page.showInFooter = :showInFooter', {
              showInFooter: true,
            });
          }),
        )
        .orderBy('page.createdAt', 'ASC')
        .getMany();

      // 转换为导航项 DTO
      const items: IPageNavItemDto[] = pages.map((page) => ({
        id: page.id,
        title: page.title,
        slug: page.slug,
        showInNav: page.showInNav,
        showInFooter: page.showInFooter,
      }));

      this.log(`导航和Footer页面查询成功，共 ${items.length} 条`);

      return items;
    } catch (error) {
      this.error(`查询导航和Footer页面失败: ${error.message}`);
      throw new BusinessException('查询导航和Footer页面失败，请稍后重试');
    }
  }

  /**
   * 删除页面
   * @param id 页面ID
   */
  async remove(id: number): Promise<void> {
    this.log(`开始删除页面，页面ID: ${id}`);

    try {
      // 检查页面是否存在
      const page = await this.pageRepo.findOne({ where: { id } });

      if (isNil(page)) {
        this.warn(`页面 #${id} 不存在`);
        throw new BusinessException('页面不存在');
      }

      // 删除页面
      await this.pageRepo.remove(page);
      this.log(`页面 #${id} 删除成功`);
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`删除页面失败: ${error.message}`);
      throw new BusinessException('删除页面失败，请稍后重试');
    }
  }
}
