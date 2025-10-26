import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './User';
import { CommentEntity } from './Comment';

export interface PostExportData {
  id: number;
  title: string;
  content: string;
  summary?: string;
  cover?: string;
  status: 'draft' | 'published' | 'archived';
  viewCount: number;
  authorId: number;
  author?: {
    id: number;
    name: string;
    avatar?: string;
  };
  tags?: string[];
  extra?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

@Entity({
  name: 'posts',
})
export class PostEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: false,
    type: 'varchar',
    length: 255,
  })
  title: string;

  @Column({
    nullable: false,
    type: 'text',
  })
  content: string;

  @Column({
    nullable: true,
    type: 'varchar',
    length: 500,
  })
  summary: string;

  @Column({
    nullable: true,
    type: 'varchar',
    length: 500,
  })
  cover: string;

  @Column({
    nullable: false,
    type: 'enum',
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  })
  status: 'draft' | 'published' | 'archived';

  @Column({
    nullable: false,
    type: 'int',
    default: 0,
  })
  viewCount: number;

  @Column({
    nullable: true,
    type: 'simple-array',
  })
  tags: string[];

  @Column({
    nullable: true,
    type: 'json',
  })
  extra: Record<string, any>;

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

  // 关联评论（一对多）
  @OneToMany(() => CommentEntity, (comment) => comment.post)
  comments: CommentEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public getData(includeAuthor = false): PostExportData {
    const data: PostExportData = {
      id: this.id,
      title: this.title,
      content: this.content,
      summary: this.summary,
      cover: this.cover,
      status: this.status,
      viewCount: this.viewCount,
      authorId: this.authorId,
      tags: this.tags,
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
