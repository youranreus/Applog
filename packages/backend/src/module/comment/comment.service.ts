import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import {
  SYSTEM_CONFIG_KEYS,
  SYSTEM_CONFIG_PREFIX_DEFAULT,
  getSystemConfigKey,
} from '@applog/common';
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import { paginate, type Pagination } from 'nestjs-typeorm-paginate';
import {
  CommentEntity,
  getUserPublicId,
  PageEntity,
  PostEntity,
  SystemConfigEntity,
} from '@/entities';
import type {
  AdminQueryCommentDto,
  ApproveCommentDto,
  CreateCommentDto,
  IAdminCommentDto,
  ICreateCommentResponseDto,
  ICommentLocationDto,
  IDeleteImpactDto,
  IPublicCommentDto,
  PendingCapabilityDto,
  QueryCommentDto,
} from './dto';
import {
  gravatarUrl,
  hashWithdrawToken,
  matchesWithdrawToken,
} from './comment-security.utils';
import { NotificationService } from '@/module/notification/notification.service';

export type CommentTarget =
  | { postId: number; pageId?: never }
  | { pageId: number; postId?: never };

@Injectable()
export class CommentService {
  @InjectRepository(CommentEntity)
  private commentRepo: Repository<CommentEntity>;
  @InjectRepository(PostEntity) private postRepo: Repository<PostEntity>;
  @InjectRepository(PageEntity) private pageRepo: Repository<PageEntity>;
  @InjectRepository(SystemConfigEntity)
  private configRepo: Repository<SystemConfigEntity>;
  @Inject(HLOGGER_TOKEN) private logger: HLogger;

  private readonly adminRoleValue: number;
  private readonly baseConfigKey: string;

  constructor(
    private config: ConfigService,
    private dataSource: DataSource,
    private readonly notificationService: NotificationService,
  ) {
    this.adminRoleValue = this.config.get<number>('SYSTEM_ADMIN_ROLE_VALUE', 0);
    this.baseConfigKey = getSystemConfigKey(
      SYSTEM_CONFIG_KEYS.BASE_CONFIG,
      this.config.get<string>(
        'SYSTEM_CONFIG_PREFIX',
        SYSTEM_CONFIG_PREFIX_DEFAULT,
      ),
    );
  }

  async create(
    dto: CreateCommentDto,
    user: UserJwtPayload | undefined,
    requestContext: { ip: string; agent?: string },
  ): Promise<ICreateCommentResponseDto> {
    const target = this.resolveTarget(dto);
    this.log(
      `开始创建评论，目标: ${this.targetKey(target)}，父评论ID: ${dto.parentId ?? '无'}`,
    );
    try {
      if (!(await this.isCommentAllowed())) {
        throw new BusinessException('评论功能已关闭');
      }

      const content = dto.content.trim();
      if (!content) throw new BusinessException('评论内容不能为空');

      await this.assertPublishedTarget(target);

      if (dto.parentId) {
        const parent = await this.commentRepo.findOne({
          where: { id: dto.parentId },
        });
        if (!parent) throw new BusinessException('父评论不存在');
        if (!this.hasTarget(parent, target))
          throw new BusinessException('父评论不属于该评论目标');
        if (parent.status !== 'approved')
          throw new BusinessException('不能回复未公开的评论');
      }

      const isGuest = !user?.id;
      if (isGuest && (!dto.guestName?.trim() || !dto.guestEmail?.trim())) {
        throw new BusinessException('游客需提供昵称和邮箱');
      }

      if (!this.isAdmin(user)) {
        const recent = await this.commentRepo.count({
          where: {
            ...target,
            ip: requestContext.ip,
            createdAt: MoreThanOrEqual(new Date(Date.now() - 60_000)),
          },
        });
        if (recent > 0)
          throw new BusinessException('评论太频繁，请 60 秒后再试');
      }

      const token = isGuest ? randomBytes(32).toString('base64url') : undefined;
      const comment = this.commentRepo.create({
        content,
        ...target,
        parentId: dto.parentId,
        authorId: user?.id,
        status: isGuest ? 'pending' : 'approved',
        likeCount: 0,
        guestName: isGuest ? dto.guestName?.trim() : undefined,
        guestEmail: isGuest ? dto.guestEmail?.trim() : undefined,
        guestSite: isGuest ? dto.guestSite?.trim() : undefined,
        ip: requestContext.ip,
        agent: requestContext.agent?.slice(0, 255),
        withdrawTokenHash: token ? hashWithdrawToken(token) : undefined,
      });
      const saved = await this.commentRepo.save(comment);
      const hydrated = await this.commentRepo.findOne({
        where: { id: saved.id },
        relations: ['author'],
      });
      this.log(
        `评论创建成功，评论ID: ${saved.id}，目标: ${this.targetKey(target)}`,
      );
      if (!this.isAdmin(user)) {
        await this.notificationService.notifyNewComment(hydrated ?? saved);
      }
      const publicComment = this.toPublic(hydrated ?? saved);
      return token
        ? { comment: publicComment, withdrawToken: token }
        : { comment: publicComment };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.error(`创建评论失败: ${this.errorMessage(error)}`);
      throw new BusinessException('创建评论失败，请稍后重试');
    }
  }

  async findAll(dto: QueryCommentDto): Promise<Pagination<IPublicCommentDto>> {
    try {
      const target = this.resolveTarget(dto);
      const [field, id] = this.targetEntry(target);
      const rootsQuery = this.commentRepo
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.author', 'author')
        .where(`comment.${field} = :targetId`, { targetId: id })
        .andWhere('comment.status = :status', { status: 'approved' })
        .andWhere('comment.parentId IS NULL')
        .orderBy('comment.createdAt', 'DESC')
        .addOrderBy('comment.id', 'DESC');
      const roots = await paginate(rootsQuery, {
        page: dto.page ?? 1,
        limit: dto.limit ?? 10,
      });
      const descendants = await this.findDescendants(
        roots.items.map((item) => item.id),
        'approved',
        target,
      );
      const items = this.buildPublicTree([...roots.items, ...descendants]);
      return { items, meta: roots.meta, links: roots.links };
    } catch (error) {
      this.error(`查询公开评论失败: ${this.errorMessage(error)}`);
      throw new BusinessException('查询评论列表失败，请稍后重试');
    }
  }

  async findOne(id: number): Promise<IPublicCommentDto> {
    const comment = await this.commentRepo.findOne({
      where: { id, status: 'approved' },
      relations: ['author'],
    });
    if (!comment) throw new BusinessException('评论不存在');
    const target = this.tryResolveTarget(comment);
    if (!target || !(await this.hasPublicAncestorChain(comment, target))) {
      throw new BusinessException('评论不存在');
    }
    const descendants = await this.findDescendants([id], 'approved', target);
    return (
      this.buildPublicTree([comment, ...descendants])[0] ??
      this.toPublic(comment)
    );
  }

  async findLocation(id: number, limit: number): Promise<ICommentLocationDto> {
    const comment = await this.commentRepo.findOne({
      where: { id, status: 'approved' },
      select: ['id', 'postId', 'pageId', 'parentId'],
    });
    if (!comment) throw new BusinessException('评论不存在');
    const target = this.tryResolveTarget(comment);
    if (!target) throw new BusinessException('评论不存在');

    let root = comment;
    const visited = new Set<number>([comment.id]);
    while (root.parentId) {
      if (visited.has(root.parentId)) {
        throw new BusinessException('评论不存在');
      }
      visited.add(root.parentId);
      const parent = await this.commentRepo.findOne({
        where: {
          id: root.parentId,
          ...target,
          status: 'approved',
        },
        select: ['id', 'postId', 'pageId', 'parentId', 'createdAt'],
      });
      if (!parent) throw new BusinessException('评论不存在');
      root = parent;
    }

    const hydratedRoot = root.createdAt
      ? root
      : await this.commentRepo.findOne({
          where: { id: root.id, status: 'approved' },
          select: ['id', 'postId', 'pageId', 'parentId', 'createdAt'],
        });
    if (!hydratedRoot) throw new BusinessException('评论不存在');

    const [field, targetId] = this.targetEntry(target);
    const newerRootCount = await this.commentRepo
      .createQueryBuilder('comment')
      .where(`comment.${field} = :targetId`, { targetId })
      .andWhere('comment.status = :status', { status: 'approved' })
      .andWhere('comment.parentId IS NULL')
      .andWhere(
        '(comment.createdAt > :createdAt OR (comment.createdAt = :createdAt AND comment.id > :rootId))',
        { createdAt: hydratedRoot.createdAt, rootId: hydratedRoot.id },
      )
      .getCount();

    return {
      page: Math.floor(newerRootCount / limit) + 1,
      rootCommentId: hydratedRoot.id,
    };
  }

  async resolvePending(
    capabilities: PendingCapabilityDto[],
  ): Promise<IPublicCommentDto[]> {
    if (!capabilities.length) return [];
    const ids = [...new Set(capabilities.map((item) => item.commentId))];
    const comments = await this.commentRepo
      .createQueryBuilder('comment')
      .addSelect('comment.withdrawTokenHash')
      .leftJoinAndSelect('comment.author', 'author')
      .where('comment.id IN (:...ids)', { ids })
      .andWhere('comment.status = :status', { status: 'pending' })
      .getMany();
    const byId = new Map(comments.map((item) => [item.id, item]));
    const resolvedIds = new Set<number>();
    return capabilities.flatMap((capability) => {
      const comment = byId.get(capability.commentId);
      if (
        !comment ||
        resolvedIds.has(comment.id) ||
        !matchesWithdrawToken(comment.withdrawTokenHash, capability.token)
      ) {
        return [];
      }
      resolvedIds.add(comment.id);
      return [this.toPublic(comment)];
    });
  }

  async withdraw(id: number, token: string): Promise<{ deleted: boolean }> {
    const comment = await this.commentRepo
      .createQueryBuilder('comment')
      .addSelect('comment.withdrawTokenHash')
      .where('comment.id = :id', { id })
      .andWhere('comment.status = :status', { status: 'pending' })
      .getOne();
    if (!comment || !matchesWithdrawToken(comment.withdrawTokenHash, token)) {
      throw new BusinessException('无法撤回该评论');
    }
    await this.remove(id);
    this.log(`待审核评论已撤回，评论ID: ${id}`);
    return { deleted: true };
  }

  async findAdmin(
    dto: AdminQueryCommentDto,
  ): Promise<Pagination<IAdminCommentDto>> {
    const query = this.commentRepo
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .leftJoinAndSelect('comment.post', 'post')
      .leftJoinAndSelect('comment.page', 'page')
      .orderBy('comment.createdAt', 'DESC');
    if (dto.status)
      query.andWhere('comment.status = :status', { status: dto.status });
    if (dto.postId)
      query.andWhere('comment.postId = :postId', { postId: dto.postId });
    if (dto.pageId)
      query.andWhere('comment.pageId = :pageId', { pageId: dto.pageId });
    const page = await paginate(query, { page: dto.page, limit: dto.limit });
    const all = await this.commentRepo.find({ select: ['id', 'parentId'] });
    const counts = this.descendantCounts(all);
    return {
      items: page.items.map((comment) =>
        this.toAdmin(comment, counts.get(comment.id) ?? 0),
      ),
      meta: page.meta,
      links: page.links,
    };
  }

  async approve(id: number, dto: ApproveCommentDto): Promise<IAdminCommentDto> {
    const comment = await this.commentRepo.findOne({
      where: { id },
      relations: ['author', 'post', 'page'],
    });
    if (!comment) throw new BusinessException('评论不存在');
    if (comment.status === dto.status) {
      return this.toAdmin(
        comment,
        (await this.getDeleteImpact(id)).descendantCount,
      );
    }
    comment.status = dto.status;
    comment.withdrawTokenHash = null;
    const saved = await this.commentRepo.save(comment);
    this.log(`评论审核完成，评论ID: ${id}，状态: ${dto.status}`);
    await this.notificationService.notifyCommentStatus(saved);
    return this.toAdmin(
      saved,
      (await this.getDeleteImpact(id)).descendantCount,
    );
  }

  async update(id: number, content: string): Promise<IAdminCommentDto> {
    const comment = await this.commentRepo.findOne({
      where: { id },
      relations: ['author', 'post', 'page'],
    });
    if (!comment) throw new BusinessException('评论不存在');
    comment.content = content.trim();
    const saved = await this.commentRepo.save(comment);
    return this.toAdmin(
      saved,
      (await this.getDeleteImpact(id)).descendantCount,
    );
  }

  async react(id: number): Promise<IPublicCommentDto> {
    const comment = await this.commentRepo.findOne({
      where: { id, status: 'approved' },
      relations: ['author'],
    });
    if (!comment) throw new BusinessException('评论不存在');
    const target = this.tryResolveTarget(comment);
    if (!target || !(await this.hasPublicAncestorChain(comment, target))) {
      throw new BusinessException('评论不存在');
    }
    comment.likeCount += 1;
    return this.toPublic(await this.commentRepo.save(comment));
  }

  async getDeleteImpact(id: number): Promise<IDeleteImpactDto> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) throw new BusinessException('评论不存在');
    const descendants = await this.findDescendants([id]);
    return {
      id,
      descendantCount: descendants.length,
      totalCount: descendants.length + 1,
    };
  }

  async remove(id: number): Promise<{ deletedCount: number }> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const repo = runner.manager.getRepository(CommentEntity);
      const root = await repo.findOne({ where: { id } });
      if (!root) throw new BusinessException('评论不存在');
      const ids = [
        id,
        ...(await this.findDescendantsWithRepo(repo, [id])).map(
          (item) => item.id,
        ),
      ];
      await repo.delete({ id: In(ids) });
      await runner.commitTransaction();
      this.log(`评论子树删除成功，评论ID: ${id}，数量: ${ids.length}`);
      return { deletedCount: ids.length };
    } catch (error) {
      await runner.rollbackTransaction();
      if (error instanceof BusinessException) throw error;
      this.error(`删除评论失败: ${this.errorMessage(error)}`);
      throw new BusinessException('删除评论失败，请稍后重试');
    } finally {
      await runner.release();
    }
  }

  async countByPostId(postId: number): Promise<number> {
    return this.commentRepo.count({ where: { postId } });
  }

  async countByPageId(pageId: number): Promise<number> {
    return this.commentRepo.count({ where: { pageId } });
  }

  private async isCommentAllowed(): Promise<boolean> {
    const entity = await this.configRepo.findOne({
      where: { configKey: this.baseConfigKey },
    });
    if (!entity?.configValue) return true;
    try {
      const parsed = JSON.parse(entity.configValue) as {
        allowComment?: boolean;
      };
      return parsed.allowComment !== false;
    } catch {
      return true;
    }
  }

  private isAdmin(user?: UserJwtPayload): boolean {
    return user?.role === this.adminRoleValue;
  }

  private async hasPublicAncestorChain(
    comment: Pick<CommentEntity, 'parentId'>,
    target: CommentTarget,
  ): Promise<boolean> {
    let parentId = comment.parentId;
    const visited = new Set<number>();
    while (parentId) {
      if (visited.has(parentId)) return false;
      visited.add(parentId);
      const parent = await this.commentRepo.findOne({
        where: { id: parentId, status: 'approved', ...target },
        select: ['id', 'postId', 'pageId', 'parentId'],
      });
      if (!parent) return false;
      parentId = parent.parentId;
    }
    return true;
  }

  private async findDescendants(
    parentIds: number[],
    status?: CommentEntity['status'],
    target?: CommentTarget,
  ): Promise<CommentEntity[]> {
    return this.findDescendantsWithRepo(
      this.commentRepo,
      parentIds,
      status,
      target,
    );
  }

  private async findDescendantsWithRepo(
    repo: Repository<CommentEntity>,
    parentIds: number[],
    status?: CommentEntity['status'],
    target?: CommentTarget,
  ): Promise<CommentEntity[]> {
    const result: CommentEntity[] = [];
    let frontier = parentIds;
    while (frontier.length) {
      const query = repo
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.author', 'author')
        .where('comment.parentId IN (:...frontier)', { frontier });
      if (status) query.andWhere('comment.status = :status', { status });
      if (target) {
        const [field, targetId] = this.targetEntry(target);
        query.andWhere(`comment.${field} = :targetId`, { targetId });
      }
      const children = await query
        .orderBy('comment.createdAt', 'ASC')
        .getMany();
      if (!children.length) break;
      result.push(...children);
      frontier = children.map((item) => item.id);
    }
    return result;
  }

  private buildPublicTree(comments: CommentEntity[]): IPublicCommentDto[] {
    const nodes = new Map(
      comments.map((item) => [item.id, this.toPublic(item)]),
    );
    for (const comment of comments) {
      if (comment.parentId && nodes.has(comment.parentId)) {
        const parent = nodes.get(comment.parentId)!;
        (parent.replies ??= []).push(nodes.get(comment.id)!);
      }
    }
    return comments
      .filter((item) => !item.parentId)
      .map((item) => nodes.get(item.id)!);
  }

  private toPublic(comment: CommentEntity): IPublicCommentDto {
    return {
      id: comment.id,
      content: comment.content,
      postId: comment.postId,
      pageId: comment.pageId,
      parentId: comment.parentId,
      status: comment.status === 'pending' ? 'pending' : 'approved',
      author: comment.author
        ? {
            id: getUserPublicId(comment.author),
            name: comment.author.name,
            avatar:
              comment.author.avatar?.trim() ||
              gravatarUrl(comment.author.email),
          }
        : {
            name: comment.guestName || '游客',
            avatar: gravatarUrl(comment.guestEmail),
            site: comment.guestSite,
          },
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  private toAdmin(
    comment: CommentEntity,
    descendantCount: number,
  ): IAdminCommentDto {
    return {
      id: comment.id,
      content: comment.content,
      postId: comment.postId,
      pageId: comment.pageId,
      parentId: comment.parentId,
      authorId: comment.authorId,
      author: comment.author
        ? {
            id: getUserPublicId(comment.author),
            name: comment.author.name,
            avatar: comment.author.avatar,
          }
        : undefined,
      status: comment.status,
      likeCount: comment.likeCount,
      extra: comment.extra,
      guestName: comment.guestName,
      guestEmail: comment.guestEmail,
      guestSite: comment.guestSite,
      ip: comment.ip,
      agent: comment.agent,
      source: comment.source,
      sourceId: comment.sourceId,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      post: comment.post
        ? {
            id: comment.post.id,
            title: comment.post.title,
            slug: comment.post.slug,
          }
        : undefined,
      page: comment.page
        ? {
            id: comment.page.id,
            title: comment.page.title,
            slug: comment.page.slug,
          }
        : undefined,
      descendantCount,
    };
  }

  private resolveTarget(input: {
    postId?: number;
    pageId?: number;
  }): CommentTarget {
    const target = this.tryResolveTarget(input);
    if (!target) {
      throw new BusinessException('必须且只能指定文章或页面');
    }
    return target;
  }

  private tryResolveTarget(input: {
    postId?: number;
    pageId?: number;
  }): CommentTarget | undefined {
    if (input.postId && !input.pageId) return { postId: input.postId };
    if (input.pageId && !input.postId) return { pageId: input.pageId };
    return undefined;
  }

  private targetEntry(target: CommentTarget): ['postId' | 'pageId', number] {
    return 'postId' in target
      ? ['postId', target.postId]
      : ['pageId', target.pageId];
  }

  private targetKey(target: CommentTarget): string {
    const [field, id] = this.targetEntry(target);
    return `${field === 'postId' ? 'post' : 'page'}:${id}`;
  }

  private hasTarget(
    comment: Pick<CommentEntity, 'postId' | 'pageId'>,
    target: CommentTarget,
  ): boolean {
    return 'postId' in target
      ? comment.postId === target.postId && comment.pageId == null
      : comment.pageId === target.pageId && comment.postId == null;
  }

  private async assertPublishedTarget(target: CommentTarget): Promise<void> {
    if ('postId' in target) {
      const post = await this.postRepo.findOne({
        where: { id: target.postId, status: 'published' },
      });
      if (!post) throw new BusinessException('文章不存在或未发布');
      return;
    }
    const page = await this.pageRepo.findOne({
      where: { id: target.pageId, status: 'published' },
    });
    if (!page) throw new BusinessException('页面不存在或未发布');
  }

  private descendantCounts(
    comments: Pick<CommentEntity, 'id' | 'parentId'>[],
  ): Map<number, number> {
    const children = new Map<number, number[]>();
    for (const item of comments)
      if (item.parentId)
        (
          children.get(item.parentId) ??
          children.set(item.parentId, []).get(item.parentId)!
        ).push(item.id);
    const count = (id: number): number =>
      (children.get(id) ?? []).reduce(
        (sum, child) => sum + 1 + count(child),
        0,
      );
    return new Map(comments.map((item) => [item.id, count(item.id)]));
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private log(message: string): void {
    this.logger.log(message, CommentService.name);
  }
  private error(message: string): void {
    this.logger.error(message, CommentService.name);
  }
}
