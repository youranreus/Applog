import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AnalyticsScope } from './AnalyticsDailyStat';

/**
 * 日 UV 去重表
 * 唯一键：(date, scope, scopeId, visitorId)
 * 保留约 90 天可清理
 */
@Entity({
  name: 'analytics_daily_visitor',
})
@Index(['date', 'scope', 'scopeId', 'visitorId'], { unique: true })
@Index(['date'])
export class AnalyticsDailyVisitorEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: false,
    comment: '上海日历日 YYYY-MM-DD',
  })
  date: string;

  @Column({
    type: 'enum',
    enum: ['site', 'post', 'page'],
    nullable: false,
  })
  scope: AnalyticsScope;

  @Column({
    type: 'int',
    nullable: false,
  })
  scopeId: number;

  @Column({
    type: 'varchar',
    length: 36,
    nullable: false,
    comment: '访客 UUID',
  })
  visitorId: string;

  @CreateDateColumn()
  createdAt: Date;
}
