import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import type { UserRole } from '@/utils/types';

export interface UserExportData {
  id: number | string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export function getUserPublicId(
  user: Pick<UserEntity, 'id' | 'ssoId' | 'oidcSubject'>,
): number | string {
  return user.oidcSubject ?? user.ssoId ?? user.id;
}

@Entity({
  name: 'users',
})
@Index('IDX_users_oidc_identity', ['oidcIssuer', 'oidcSubject'], {
  unique: true,
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
    type: 'int',
    nullable: true,
    unique: true,
  })
  ssoId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  oidcIssuer: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  oidcSubject: string | null;

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
      id: this.getPublicId(),
      name: this.name,
      email: this.email,
      avatar: this.avatar,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  public getPublicId(): number | string {
    return getUserPublicId(this);
  }
}
