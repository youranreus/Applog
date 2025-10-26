import { UserEntity } from './User';
import { PostEntity } from './Post';
import { CommentEntity } from './Comment';
import { CommentReactionEntity } from './CommentReaction';

export * from './User';
export * from './Post';
export * from './Comment';
export * from './CommentReaction';

export const ENTITY_LIST = [
  UserEntity,
  PostEntity,
  CommentEntity,
  CommentReactionEntity,
];
