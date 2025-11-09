import { UserEntity } from './User';
import { PostEntity } from './Post';
import { CommentEntity } from './Comment';
import { PageEntity } from './Page';

export * from './User';
export * from './Post';
export * from './Comment';
export * from './Page';

export const ENTITY_LIST = [UserEntity, PostEntity, CommentEntity, PageEntity];
