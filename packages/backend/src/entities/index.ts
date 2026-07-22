import { UserEntity } from './User';
import { PostEntity } from './Post';
import { CommentEntity } from './Comment';
import { PageEntity } from './Page';
import { SystemConfigEntity } from './SystemConfig';
import { AnalyticsDailyStatEntity } from './AnalyticsDailyStat';
import { AnalyticsDailyVisitorEntity } from './AnalyticsDailyVisitor';
import { AnalyticsViewHitEntity } from './AnalyticsViewHit';

export * from './User';
export * from './Post';
export * from './Comment';
export * from './Page';
export * from './SystemConfig';
export * from './AnalyticsDailyStat';
export * from './AnalyticsDailyVisitor';
export * from './AnalyticsViewHit';

export const ENTITY_LIST = [
  UserEntity,
  PostEntity,
  CommentEntity,
  PageEntity,
  SystemConfigEntity,
  AnalyticsDailyStatEntity,
  AnalyticsDailyVisitorEntity,
  AnalyticsViewHitEntity,
];
