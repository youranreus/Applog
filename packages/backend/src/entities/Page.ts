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

export interface PageExportData {
  id: number;
  title: string;
  content: string;
  summary?: string;
  cover?: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  viewCount: number;
  showInNav: boolean;
  showInFooter: boolean;
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
  name: 'pages',
})
export class PageEntity {
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
    type: 'varchar',
    length: 255,
    unique: true,
    comment: '页面唯一标识，用于路由',
  })
  slug: string;

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
    nullable: false,
    type: 'boolean',
    default: false,
    comment: '是否展示于导航栏',
  })
  showInNav: boolean;

  @Column({
    nullable: false,
    type: 'boolean',
    default: false,
    comment: '是否展示于footer',
  })
  showInFooter: boolean;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public getData(includeAuthor = false): PageExportData {
    const data: PageExportData = {
      id: this.id,
      title: this.title,
      content: this.content,
      summary: this.summary,
      cover: this.cover,
      slug: this.slug,
      status: this.status,
      viewCount: this.viewCount,
      showInNav: this.showInNav,
      showInFooter: this.showInFooter,
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
