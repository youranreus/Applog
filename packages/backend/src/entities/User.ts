import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { UserRole } from '@/utils/types';

export interface UserExportData {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

@Entity({
  name: 'users',
})
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: false,
  })
  name: string;

  @Column({
    nullable: false,
    unique: false,
  })
  email: string;

  @Column({
    default: null,
  })
  avatar: string;

  @Column({
    nullable: false,
    unique: true,
  })
  ssoId: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'user',
    comment: '用户角色：admin-管理员, user-普通用户',
  })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public getData(): UserExportData {
    return {
      id: this.ssoId,
      name: this.name,
      email: this.email,
      avatar: this.avatar,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
