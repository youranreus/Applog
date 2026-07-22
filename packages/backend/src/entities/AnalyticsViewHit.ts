import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 内容类型（上报与去抖）
 */
export type AnalyticsContentType = 'post' | 'page';

/**
 * 短时浏览去抖表
 * 唯一键：(visitorId, contentType, contentId)
 * 30 分钟内重复上报不计 PV/UV
 */
@Entity({
  name: 'analytics_view_hit',
})
@Index(['visitorId', 'contentType', 'contentId'], { unique: true })
export class AnalyticsViewHitEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 36,
    nullable: false,
  })
  visitorId: string;

  @Column({
    type: 'enum',
    enum: ['post', 'page'],
    nullable: false,
  })
  contentType: AnalyticsContentType;

  @Column({
    type: 'int',
    nullable: false,
  })
  contentId: number;

  @Column({
    type: 'datetime',
    nullable: false,
    comment: '上次有效计入时间',
  })
  lastHitAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
