import { UserEntity } from './User';
import { PostEntity } from './Post';
import { CommentEntity } from './Comment';

export * from './User';
export * from './Post';
export * from './Comment';

export const ENTITY_LIST = [
  UserEntity,
  PostEntity,
  CommentEntity,
];
