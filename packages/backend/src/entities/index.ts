import { UserEntity } from './User';
import { PostEntity } from './Post';
import { CommentEntity } from './Comment';
import { PageEntity } from './Page';
import { SystemConfigEntity } from './SystemConfig';

export * from './User';
export * from './Post';
export * from './Comment';
export * from './Page';
export * from './SystemConfig';

export const ENTITY_LIST = [
  UserEntity,
  PostEntity,
  CommentEntity,
  PageEntity,
  SystemConfigEntity,
];
