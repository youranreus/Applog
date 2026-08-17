import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import { Repository } from 'typeorm';
import { CommentEntity, PageEntity, PostEntity, UserEntity } from '@/entities';
import { SystemConfigService } from '@/module/system-config/system-config.service';
import { NotificationClient } from './notification.client';
import {
  COMMENT_STATUS_TEMPLATE_KEY,
  H_NOTIFICATION_BATCH_SIZE,
  NEW_COMMENT_TEMPLATE_KEY,
} from './notification.constants';
import type { HRecipient } from './notification.types';

interface NotificationTarget {
  title: string;
  typeLabel: '文章' | '页面';
  publicUrl: string;
}

@Injectable()
export class NotificationService {
  @InjectRepository(UserEntity) private userRepo: Repository<UserEntity>;
  @InjectRepository(PostEntity) private postRepo: Repository<PostEntity>;
  @InjectRepository(PageEntity) private pageRepo: Repository<PageEntity>;
  @Inject(HLOGGER_TOKEN) private logger: HLogger;

  constructor(
    private readonly config: ConfigService,
    private readonly systemConfigService: SystemConfigService,
    private readonly client: NotificationClient,
  ) {}

  async notifyNewComment(comment: CommentEntity): Promise<void> {
    await this.contain('new-comment', comment.id, async () => {
      const config = await this.enabledConfig();
      if (!config) return;
      const target = await this.resolveTarget(comment);
      if (!target) return;
      const admins = await this.userRepo.find({
        where: { role: 'admin' },
        select: ['ssoId'],
      });
      const validIds = [
        ...new Set(
          admins
            .map((admin) => admin.ssoId)
            .filter((id): id is number => Number.isInteger(id) && id > 0),
        ),
      ].sort((a, b) => a - b);
      const skippedCount = admins.length - validIds.length;
      if (skippedCount > 0) {
        this.logger.warn(
          `跳过无有效 ssoId 的管理员收件人 count=${skippedCount}`,
          NotificationService.name,
        );
      }
      const recipients = validIds.map<HRecipient>((userId) => ({
        kind: 'user',
        userId,
      }));
      const baseConfig = await this.systemConfigService.getBaseConfigRaw();
      await this.sendBatches(
        config.mailToken,
        recipients,
        NEW_COMMENT_TEMPLATE_KEY,
        {
          siteName: baseConfig?.title?.trim() || 'Applog',
          targetTitle: target.title,
          targetType: target.typeLabel,
          commenterName: this.commenterName(comment),
          commentExcerpt: this.excerpt(comment.content),
          adminUrl: `${this.frontUrl()}/user/comment`,
        },
        `applog-new-comment-${comment.id}`,
        'new-comment',
        comment.id,
      );
    });
  }

  async notifyCommentStatus(comment: CommentEntity): Promise<void> {
    await this.contain('comment-status', comment.id, async () => {
      const config = await this.enabledConfig();
      if (!config) return;
      const target = await this.resolveTarget(comment);
      if (!target) return;
      let recipient: HRecipient | undefined;
      if (comment.authorId) {
        const author =
          comment.author ??
          (await this.userRepo.findOne({
            where: { id: comment.authorId },
            select: ['id', 'name', 'ssoId'],
          }));
        if (!author?.ssoId || author.ssoId <= 0) {
          this.logger.warn(
            `跳过无有效 ssoId 的评论作者 commentId=${comment.id}`,
            NotificationService.name,
          );
          return;
        }
        recipient = { kind: 'user', userId: author.ssoId };
      } else if (comment.guestEmail?.trim()) {
        recipient = { kind: 'email', email: comment.guestEmail.trim() };
      }
      if (!recipient) return;
      const viewUrl =
        comment.status === 'approved'
          ? `${target.publicUrl}#comment-${comment.id}`
          : target.publicUrl;
      const timestamp = (comment.updatedAt ?? new Date()).getTime();
      await this.sendBatches(
        config.mailToken,
        [recipient],
        COMMENT_STATUS_TEMPLATE_KEY,
        {
          commenterName: this.commenterName(comment),
          targetTitle: target.title,
          targetType: target.typeLabel,
          statusLabel: comment.status === 'approved' ? '已通过' : '已拒绝',
          commentExcerpt: this.excerpt(comment.content),
          viewUrl,
        },
        `applog-comment-status-${comment.id}-${comment.status}-${timestamp}`,
        'comment-status',
        comment.id,
      );
    });
  }

  private async enabledConfig() {
    const config = await this.systemConfigService.getNotificationConfigRaw();
    return config?.enabled && config.mailToken ? config : null;
  }

  private async sendBatches(
    mailToken: string,
    recipients: HRecipient[],
    templateKey:
      | typeof COMMENT_STATUS_TEMPLATE_KEY
      | typeof NEW_COMMENT_TEMPLATE_KEY,
    variables: Record<string, string>,
    eventKey: string,
    eventKind: string,
    commentId: number,
  ): Promise<void> {
    for (
      let index = 0;
      index < recipients.length;
      index += H_NOTIFICATION_BATCH_SIZE
    ) {
      const batchIndex = Math.floor(index / H_NOTIFICATION_BATCH_SIZE);
      try {
        await this.client.send(
          mailToken,
          {
            recipients: recipients.slice(
              index,
              index + H_NOTIFICATION_BATCH_SIZE,
            ),
            content: { kind: 'template', templateKey, variables },
            idempotencyKey: `${eventKey}-b${batchIndex}`,
          },
          { eventKind, commentId, batchIndex },
        );
      } catch (error) {
        const kind = error instanceof Error ? error.name : 'unknown';
        this.logger.error(
          `评论通知批次失败 event=${eventKind} commentId=${commentId} batch=${batchIndex} error=${kind}`,
          NotificationService.name,
        );
      }
    }
  }

  private async resolveTarget(
    comment: Pick<CommentEntity, 'postId' | 'pageId'>,
  ): Promise<NotificationTarget | null> {
    if (comment.postId) {
      const post = await this.postRepo.findOne({
        where: { id: comment.postId },
        select: ['id', 'title', 'slug'],
      });
      return post
        ? {
            title: post.title,
            typeLabel: '文章',
            publicUrl: `${this.frontUrl()}/archives/${encodeURIComponent(post.slug)}.html`,
          }
        : null;
    }
    if (comment.pageId) {
      const page = await this.pageRepo.findOne({
        where: { id: comment.pageId },
        select: ['id', 'title', 'slug'],
      });
      return page
        ? {
            title: page.title,
            typeLabel: '页面',
            publicUrl: `${this.frontUrl()}/${encodeURIComponent(page.slug)}.html`,
          }
        : null;
    }
    return null;
  }

  private commenterName(comment: CommentEntity): string {
    return comment.author?.name?.trim() || comment.guestName?.trim() || '访客';
  }

  private excerpt(content: string): string {
    const plain = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const points = Array.from(plain);
    return points.length > 160 ? `${points.slice(0, 159).join('')}…` : plain;
  }

  private frontUrl(): string {
    return this.config
      .get<string>('FRONT_URL', 'http://localhost:5173')
      .replace(/\/$/, '');
  }

  private async contain(
    eventKind: string,
    commentId: number,
    action: () => Promise<void>,
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      const kind = error instanceof Error ? error.name : 'unknown';
      this.logger.error(
        `评论通知边界失败 event=${eventKind} commentId=${commentId} error=${kind}`,
        NotificationService.name,
      );
    }
  }
}
