import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './User';
import { PostEntity } from './Post';

export interface CommentExportData {
  id: number;
  content: string;
  postId: number;
  authorId: number;
  author?: {
    id: number;
    name: string;
    avatar?: string;
  };
  parentId?: number;
  status: 'pending' | 'approved' | 'rejected';
  likeCount: number;
  extra?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

@Entity({
  name: 'comments',
})
export class CommentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: false,
    type: 'text',
  })
  content: string;

  @Column({
    nullable: false,
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: 'pending' | 'approved' | 'rejected';

  @Column({
    nullable: false,
    type: 'int',
    default: 0,
  })
  likeCount: number;

  @Column({
    nullable: true,
    type: 'json',
  })
  extra: Record<string, any>;

  // 关联文章（多对一）
  @Column({
    nullable: false,
  })
  postId: number;

  @ManyToOne(() => PostEntity, (post) => post.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'postId' })
  post: PostEntity;

  // 关联作者（多对一）
  @Column({
    nullable: false,
  })
  authorId: number;

  @ManyToOne(() => UserEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'authorId' })
  author: UserEntity;

  // 父评论ID（用于回复评论，可选）
  @Column({
    nullable: true,
    type: 'int',
  })
  parentId: number;

  @ManyToOne(() => CommentEntity, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'parentId' })
  parent: CommentEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public getData(includeAuthor = false): CommentExportData {
    const data: CommentExportData = {
      id: this.id,
      content: this.content,
      postId: this.postId,
      authorId: this.authorId,
      parentId: this.parentId,
      status: this.status,
      likeCount: this.likeCount,
      extra: this.extra,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };

    if (includeAuthor && this.author) {
      data.author = {
        id: this.author.ssoId,
        name: this.author.name,
        avatar: this.author.avatar,
      };
    }

    return data;
  }
}
