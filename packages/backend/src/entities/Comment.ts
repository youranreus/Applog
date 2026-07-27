import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './User';
import { PostEntity } from './Post';
import { PageEntity } from './Page';

export interface CommentExportData {
  id: number;
  content: string;
  postId?: number;
  pageId?: number;
  authorId?: number;
  author?: {
    id: number;
    name: string;
    avatar?: string;
  };
  parentId?: number;
  status: 'pending' | 'approved' | 'rejected';
  likeCount: number;
  extra?: Record<string, any>;
  guestName?: string;
  guestEmail?: string;
  guestSite?: string;
  ip?: string;
  agent?: string;
  source?: string;
  sourceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Entity({
  name: 'comments',
})
@Index('IDX_comments_post_status_parent', ['postId', 'status', 'parentId'])
@Index('IDX_comments_post_ip_created', ['postId', 'ip', 'createdAt'])
@Index('IDX_comments_page_status_parent', ['pageId', 'status', 'parentId'])
@Index('IDX_comments_page_ip_created', ['pageId', 'ip', 'createdAt'])
@Index('UQ_comments_source_sourceId', ['source', 'sourceId'], { unique: true })
export class CommentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: false,
    type: 'mediumtext',
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

  @Column({
    nullable: true,
    type: 'varchar',
    length: 200,
  })
  guestName?: string;

  @Column({
    nullable: true,
    type: 'varchar',
    length: 200,
  })
  guestEmail?: string;

  @Column({
    nullable: true,
    type: 'varchar',
    length: 200,
  })
  guestSite?: string;

  @Column({
    nullable: true,
    type: 'varchar',
    length: 64,
  })
  ip?: string;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  agent?: string;

  @Column({ nullable: true, type: 'char', length: 64, select: false })
  withdrawTokenHash?: string | null;

  @Column({ nullable: true, type: 'varchar', length: 32 })
  source?: string;

  @Column({ nullable: true, type: 'varchar', length: 64 })
  sourceId?: string;

  // 关联文章（多对一）
  @Column({
    nullable: true,
    type: 'int',
  })
  postId?: number;

  @ManyToOne(() => PostEntity, (post) => post.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'postId' })
  post?: PostEntity;

  // 关联独立页面（与 postId 恰有一个非空）
  @Column({
    nullable: true,
    type: 'int',
  })
  pageId?: number;

  @ManyToOne(() => PageEntity, (page) => page.comments, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'pageId' })
  page?: PageEntity;

  // 关联作者（多对一）
  @Column({
    nullable: true,
    type: 'int',
  })
  authorId?: number;

  @ManyToOne(() => UserEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'authorId' })
  author?: UserEntity;

  // 父评论ID（用于回复评论，可选）
  @Column({
    nullable: true,
    type: 'int',
  })
  parentId?: number;

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
      pageId: this.pageId,
      authorId: this.authorId,
      parentId: this.parentId,
      status: this.status,
      likeCount: this.likeCount,
      guestName: this.guestName,
      guestSite: this.guestSite,
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
