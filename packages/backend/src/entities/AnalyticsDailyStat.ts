import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 统计作用域类型
 */
export type AnalyticsScope = 'site' | 'post' | 'page';

/**
 * 日聚合统计可序列化形状
 */
export interface AnalyticsDailyStatExportData {
  id: number;
  date: string;
  scope: AnalyticsScope;
  scopeId: number;
  pv: number;
  uv: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 站点级 + 内容级日聚合统计
 * 唯一键：(date, scope, scopeId)
 */
@Entity({
  name: 'analytics_daily_stat',
})
@Index(['date', 'scope', 'scopeId'], { unique: true })
export class AnalyticsDailyStatEntity {
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
    comment: 'site 固定为 0；内容为实体 id',
  })
  scopeId: number;

  @Column({
    type: 'int',
    nullable: false,
    default: 0,
  })
  pv: number;

  @Column({
    type: 'int',
    nullable: false,
    default: 0,
  })
  uv: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * 导出可序列化数据
   * @returns 日聚合统计数据
   */
  public getData(): AnalyticsDailyStatExportData {
    return {
      id: this.id,
      date: this.date,
      scope: this.scope,
      scopeId: this.scopeId,
      pv: this.pv,
      uv: this.uv,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
