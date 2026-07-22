import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import {
  AnalyticsDailyStatEntity,
  AnalyticsDailyVisitorEntity,
  AnalyticsViewHitEntity,
  PostEntity,
  PageEntity,
  type AnalyticsContentType,
  type AnalyticsScope,
} from '@/entities';
import type { ReportViewDto } from './dto';
import type {
  IAnalyticsSummaryDto,
  IAnalyticsTrendPointDto,
  IAnalyticsTopItemDto,
} from './dto';
import {
  ANALYTICS_DEBOUNCE_MS,
  ANALYTICS_DEFAULT_TOP_LIMIT,
  ANALYTICS_DEFAULT_TREND_DAYS,
  ANALYTICS_SITE_SCOPE_ID,
  ANALYTICS_SUMMARY_DAYS,
  ANALYTICS_TIMEZONE,
  ANALYTICS_VISITOR_RETENTION_DAYS,
} from './analytics.constants';

/**
 * 内容作者信息（用于上报校验）
 */
interface IContentAuthorInfo {
  authorId: number;
  status: string;
}

/**
 * PV/UV 统计服务
 * 负责浏览上报、日聚合与管理员查询
 */
@Injectable()
export class AnalyticsService {
  @InjectRepository(AnalyticsDailyStatEntity)
  private dailyStatRepo: Repository<AnalyticsDailyStatEntity>;

  @InjectRepository(AnalyticsDailyVisitorEntity)
  private dailyVisitorRepo: Repository<AnalyticsDailyVisitorEntity>;

  @InjectRepository(PostEntity)
  private postRepo: Repository<PostEntity>;

  @InjectRepository(PageEntity)
  private pageRepo: Repository<PageEntity>;

  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  constructor(private dataSource: DataSource) {}

  /**
   * 记录日志
   * @param text - 日志内容
   */
  private log(text: string): void {
    this.logger.log(text, AnalyticsService.name);
  }

  /**
   * 记录错误日志
   * @param text - 错误内容
   */
  private error(text: string): void {
    this.logger.error(text, AnalyticsService.name);
  }

  /**
   * 获取 Asia/Shanghai 日历日字符串 YYYY-MM-DD
   * @param date - 参考时间，默认当前
   * @returns 上海日历日
   */
  getShanghaiDateString(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: ANALYTICS_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  /**
   * 生成从 startDate 起连续 N 天的日期列表（含 start 共 days 天，向过去）
   * @param endDate - 结束日（含），YYYY-MM-DD
   * @param days - 天数
   * @returns 升序日期数组
   */
  buildDateRange(endDate: string, days: number): string[] {
    const dates: string[] = [];
    const end = new Date(`${endDate}T12:00:00+08:00`);
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
      dates.push(this.getShanghaiDateString(d));
    }
    return dates;
  }

  /**
   * 加载已发布内容的作者信息；非法目标返回 null（上报 no-op）
   * @param contentType - post | page
   * @param contentId - 实体 id
   * @returns 作者信息或 null
   */
  private async loadPublishedContent(
    contentType: AnalyticsContentType,
    contentId: number,
  ): Promise<IContentAuthorInfo | null> {
    if (contentType === 'post') {
      const post = await this.postRepo.findOne({
        where: { id: contentId },
        select: ['id', 'authorId', 'status'],
      });
      if (!post || post.status !== 'published') {
        return null;
      }
      return { authorId: post.authorId, status: post.status };
    }

    const page = await this.pageRepo.findOne({
      where: { id: contentId },
      select: ['id', 'authorId', 'status'],
    });
    if (!page || page.status !== 'published') {
      return null;
    }
    return { authorId: page.authorId, status: page.status };
  }

  /**
   * 尝试插入日 UV 去重行；插入成功表示新 UV
   * @param manager - 事务 EntityManager
   * @param date - 上海日历日
   * @param scope - 作用域
   * @param scopeId - 作用域 id
   * @param visitorId - 访客 UUID
   * @returns 是否计入新 UV
   */
  private async tryInsertDailyVisitor(
    manager: EntityManager,
    date: string,
    scope: AnalyticsScope,
    scopeId: number,
    visitorId: string,
  ): Promise<boolean> {
    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(AnalyticsDailyVisitorEntity)
      .values({ date, scope, scopeId, visitorId })
      .orIgnore()
      .execute();

    // MySQL INSERT IGNORE：新行 affectedRows=1；冲突为 0。identifiers 作兜底。
    const raw = result.raw as { affectedRows?: number } | undefined;
    if (typeof raw?.affectedRows === 'number') {
      return raw.affectedRows > 0;
    }
    return (result.identifiers?.length ?? 0) > 0;
  }

  /**
   * 原子递增日聚合 PV，并按需递增 UV（避免并发 find-save 丢计数）
   * @param manager - 事务 EntityManager
   * @param date - 上海日历日
   * @param scope - 作用域
   * @param scopeId - 作用域 id
   * @param uvDelta - UV 增量（0 或 1）
   */
  private async bumpDailyStat(
    manager: EntityManager,
    date: string,
    scope: AnalyticsScope,
    scopeId: number,
    uvDelta: number,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO \`analytics_daily_stat\` (\`date\`, \`scope\`, \`scopeId\`, \`pv\`, \`uv\`)
       VALUES (?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE \`pv\` = \`pv\` + 1, \`uv\` = \`uv\` + VALUES(\`uv\`)`,
      [date, scope, scopeId, uvDelta],
    );
  }

  /**
   * 上报一次内容浏览（公开接口）
   * 非法目标 / 作者本人 / 30 分钟去抖 → 静默成功 no-op
   * @param dto - 上报参数
   * @param user - 可选登录用户（JWT 中 id 为数据库用户 id）
   * @returns 空对象（成功信封由拦截器包装）
   *
   * 逻辑说明：
   * 1. 校验目标为已发布内容
   * 2. 登录作者本人不计
   * 3. 30 分钟去抖窗口内不计
   * 4. 事务内更新 hit、site/content 聚合与日 UV 去重
   */
  async reportView(
    dto: ReportViewDto,
    user?: UserJwtPayload,
  ): Promise<Record<string, never>> {
    try {
      const content = await this.loadPublishedContent(
        dto.contentType,
        dto.contentId,
      );

      // 未发布或不存在：静默成功，避免探测
      if (!content) {
        return {};
      }

      // 作者本人不计（JWT id 为数据库用户 id，与 authorId 一致）
      if (user?.id != null && user.id === content.authorId) {
        return {};
      }

      const now = new Date();
      const today = this.getShanghaiDateString(now);
      const contentScope: AnalyticsScope = dto.contentType;

      await this.dataSource.transaction(async (manager) => {
        const hitRepo = manager.getRepository(AnalyticsViewHitEntity);
        const existingHit = await hitRepo.findOne({
          where: {
            visitorId: dto.visitorId,
            contentType: dto.contentType,
            contentId: dto.contentId,
          },
        });

        if (
          existingHit &&
          now.getTime() - existingHit.lastHitAt.getTime() <
            ANALYTICS_DEBOUNCE_MS
        ) {
          return;
        }

        if (existingHit) {
          existingHit.lastHitAt = now;
          await hitRepo.save(existingHit);
        } else {
          await hitRepo.save(
            hitRepo.create({
              visitorId: dto.visitorId,
              contentType: dto.contentType,
              contentId: dto.contentId,
              lastHitAt: now,
            }),
          );
        }

        const siteUv = await this.tryInsertDailyVisitor(
          manager,
          today,
          'site',
          ANALYTICS_SITE_SCOPE_ID,
          dto.visitorId,
        );
        const contentUv = await this.tryInsertDailyVisitor(
          manager,
          today,
          contentScope,
          dto.contentId,
          dto.visitorId,
        );

        await this.bumpDailyStat(
          manager,
          today,
          'site',
          ANALYTICS_SITE_SCOPE_ID,
          siteUv ? 1 : 0,
        );
        await this.bumpDailyStat(
          manager,
          today,
          contentScope,
          dto.contentId,
          contentUv ? 1 : 0,
        );
      });

      return {};
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`上报浏览失败: ${(error as Error).message}`);
      throw new BusinessException('上报浏览失败，请稍后重试');
    }
  }

  /**
   * 汇总指定日期范围内站点级 PV/UV
   * @param dates - 日期列表
   * @returns { pv, uv }
   */
  private async sumSiteStats(
    dates: string[],
  ): Promise<{ pv: number; uv: number }> {
    if (dates.length === 0) {
      return { pv: 0, uv: 0 };
    }

    const rows = await this.dailyStatRepo.find({
      where: {
        date: In(dates),
        scope: 'site',
        scopeId: ANALYTICS_SITE_SCOPE_ID,
      },
    });

    return rows.reduce(
      (acc, row) => {
        acc.pv += row.pv;
        acc.uv += row.uv;
        return acc;
      },
      { pv: 0, uv: 0 },
    );
  }

  /**
   * 获取站点流量摘要（今日 + 近 7 日）
   * @returns 摘要 DTO
   */
  async getSummary(): Promise<IAnalyticsSummaryDto> {
    try {
      const today = this.getShanghaiDateString();
      const last7Dates = this.buildDateRange(today, ANALYTICS_SUMMARY_DAYS);

      const [todayStats, last7Stats] = await Promise.all([
        this.sumSiteStats([today]),
        this.sumSiteStats(last7Dates),
      ]);

      return {
        todayPv: todayStats.pv,
        todayUv: todayStats.uv,
        last7DaysPv: last7Stats.pv,
        last7DaysUv: last7Stats.uv,
      };
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`查询流量摘要失败: ${(error as Error).message}`);
      throw new BusinessException('查询流量摘要失败，请稍后重试');
    }
  }

  /**
   * 获取站点日趋势序列（缺日补 0）
   * @param days - 天数，默认 30
   * @returns 升序日序列
   */
  async getTrend(
    days = ANALYTICS_DEFAULT_TREND_DAYS,
  ): Promise<IAnalyticsTrendPointDto[]> {
    try {
      const today = this.getShanghaiDateString();
      const dates = this.buildDateRange(today, days);

      const rows = await this.dailyStatRepo.find({
        where: {
          date: In(dates),
          scope: 'site',
          scopeId: ANALYTICS_SITE_SCOPE_ID,
        },
      });

      const map = new Map(rows.map((r) => [r.date, r]));

      return dates.map((date) => {
        const row = map.get(date);
        return {
          date,
          pv: row?.pv ?? 0,
          uv: row?.uv ?? 0,
        };
      });
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`查询流量趋势失败: ${(error as Error).message}`);
      throw new BusinessException('查询流量趋势失败，请稍后重试');
    }
  }

  /**
   * 获取内容 Top 榜（近 N 日按 PV 降序）
   * @param type - post | page
   * @param days - 天数，默认 30
   * @param limit - 条数，默认 10
   * @returns Top 列表（含标题、slug）
   */
  async getTop(
    type: AnalyticsContentType,
    days = ANALYTICS_DEFAULT_TREND_DAYS,
    limit = ANALYTICS_DEFAULT_TOP_LIMIT,
  ): Promise<IAnalyticsTopItemDto[]> {
    try {
      const today = this.getShanghaiDateString();
      const startDate = this.buildDateRange(today, days)[0];

      const aggregated = await this.dailyStatRepo
        .createQueryBuilder('stat')
        .select('stat.scopeId', 'scopeId')
        .addSelect('SUM(stat.pv)', 'pv')
        .addSelect('SUM(stat.uv)', 'uv')
        .where('stat.scope = :scope', { scope: type })
        .andWhere('stat.date >= :startDate', { startDate })
        .andWhere('stat.date <= :today', { today })
        .groupBy('stat.scopeId')
        .orderBy('SUM(stat.pv)', 'DESC')
        .limit(limit)
        .getRawMany<{ scopeId: string; pv: string; uv: string }>();

      if (aggregated.length === 0) {
        return [];
      }

      const ids = aggregated.map((row) => Number(row.scopeId));
      const titleMap = new Map<number, { title: string; slug: string }>();

      if (type === 'post') {
        const posts = await this.postRepo.find({
          where: { id: In(ids) },
          select: ['id', 'title', 'slug'],
        });
        posts.forEach((p) => {
          titleMap.set(p.id, { title: p.title, slug: p.slug });
        });
      } else {
        const pages = await this.pageRepo.find({
          where: { id: In(ids) },
          select: ['id', 'title', 'slug'],
        });
        pages.forEach((p) => {
          titleMap.set(p.id, { title: p.title, slug: p.slug });
        });
      }

      return aggregated.map((row) => {
        const contentId = Number(row.scopeId);
        const meta = titleMap.get(contentId);
        return {
          contentType: type,
          contentId,
          title: meta?.title ?? `已删除内容 #${contentId}`,
          slug: meta?.slug ?? '',
          pv: Number(row.pv) || 0,
          uv: Number(row.uv) || 0,
        };
      });
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`查询内容榜失败: ${(error as Error).message}`);
      throw new BusinessException('查询内容榜失败，请稍后重试');
    }
  }

  /**
   * 清理过期日 UV 去重行（约 90 天前）
   * MVP 不挂定时任务，供运维或后续调度调用
   * @param retentionDays - 保留天数
   * @returns 删除行数
   */
  async cleanupExpiredVisitors(
    retentionDays = ANALYTICS_VISITOR_RETENTION_DAYS,
  ): Promise<number> {
    try {
      const today = this.getShanghaiDateString();
      const cutoff = this.buildDateRange(today, retentionDays + 1)[0];

      const result = await this.dailyVisitorRepo
        .createQueryBuilder()
        .delete()
        .where('date < :cutoff', { cutoff })
        .execute();

      const deleted = result.affected ?? 0;
      this.log(`清理日 UV 去重行完成，cutoff=${cutoff}，删除 ${deleted} 行`);
      return deleted;
    } catch (error) {
      this.error(`清理日 UV 去重失败: ${(error as Error).message}`);
      throw new BusinessException('清理日 UV 去重失败，请稍后重试');
    }
  }
}
