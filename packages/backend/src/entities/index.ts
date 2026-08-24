import { UserEntity } from './User';
import { PostEntity } from './Post';
import { CommentEntity } from './Comment';
import { PageEntity } from './Page';
import { SystemConfigEntity } from './SystemConfig';
import { AnalyticsDailyStatEntity } from './AnalyticsDailyStat';
import { AnalyticsDailyVisitorEntity } from './AnalyticsDailyVisitor';
import { AnalyticsViewHitEntity } from './AnalyticsViewHit';
import { GarminCredentialEntity } from './GarminCredential';
import { GarminActivitySnapshotEntity } from './GarminActivitySnapshot';
import { GarminSyncStateEntity } from './GarminSyncState';
import { GarminPrivateActivityEntity } from './GarminPrivateActivity';
import { GarminPrivatePayloadEntity } from './GarminPrivatePayload';
import { GarminActivityDetailEntity } from './GarminActivityDetail';
import { GarminHealthDailyEntity } from './GarminHealthDaily';
import { GarminSyncStreamStateEntity } from './GarminSyncStreamState';
import { GarminActivityCoverEntity } from './GarminActivityCover';
import { FlomoConfigEntity } from './FlomoConfig';
import { FlomoPublicMemoEntity } from './FlomoPublicMemo';
import { FlomoSyncStateEntity } from './FlomoSyncState';
import { GalleryConfigEntity } from './GalleryConfig';
import { GalleryAlbumEntity } from './GalleryAlbum';
import { GalleryPhotoEntity } from './GalleryPhoto';

export * from './User';
export * from './Post';
export * from './Comment';
export * from './Page';
export * from './SystemConfig';
export * from './AnalyticsDailyStat';
export * from './AnalyticsDailyVisitor';
export * from './AnalyticsViewHit';
export * from './GarminCredential';
export * from './GarminActivitySnapshot';
export * from './GarminSyncState';
export * from './GarminPrivateActivity';
export * from './GarminPrivatePayload';
export * from './GarminActivityDetail';
export * from './GarminHealthDaily';
export * from './GarminSyncStreamState';
export * from './GarminActivityCover';
export * from './FlomoConfig';
export * from './FlomoPublicMemo';
export * from './FlomoSyncState';
export * from './GalleryConfig';
export * from './GalleryAlbum';
export * from './GalleryPhoto';

export const ENTITY_LIST = [
  UserEntity,
  PostEntity,
  CommentEntity,
  PageEntity,
  SystemConfigEntity,
  AnalyticsDailyStatEntity,
  AnalyticsDailyVisitorEntity,
  AnalyticsViewHitEntity,
  GarminCredentialEntity,
  GarminActivitySnapshotEntity,
  GarminSyncStateEntity,
  GarminPrivateActivityEntity,
  GarminPrivatePayloadEntity,
  GarminActivityDetailEntity,
  GarminHealthDailyEntity,
  GarminSyncStreamStateEntity,
  GarminActivityCoverEntity,
  FlomoConfigEntity,
  FlomoPublicMemoEntity,
  FlomoSyncStateEntity,
  GalleryConfigEntity,
  GalleryAlbumEntity,
  GalleryPhotoEntity,
];
