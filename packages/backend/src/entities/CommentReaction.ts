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
import { CommentEntity } from './Comment';

export type ReactionType = 'like' | 'dislike';

export interface CommentReactionExportData {
  id: number;
  commentId: number;
  userId: number;
  type: ReactionType;
  createdAt: Date;
  updatedAt: Date;
}

@Entity({
  name: 'comment_reactions',
})
@Index(['commentId', 'userId'], { unique: true }) // 确保一个用户对一条评论只能有一个反馈
export class CommentReactionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: false,
    type: 'enum',
    enum: ['like', 'dislike'],
  })
  type: ReactionType;

  // 关联评论（多对一）
  @Column({
    nullable: false,
  })
  commentId: number;

  @ManyToOne(() => CommentEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'commentId' })
  comment: CommentEntity;

  // 关联用户（多对一）
  @Column({
    nullable: false,
  })
  userId: number;

  @ManyToOne(() => UserEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public getData(): CommentReactionExportData {
    return {
      id: this.id,
      commentId: this.commentId,
      userId: this.userId,
      type: this.type,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
