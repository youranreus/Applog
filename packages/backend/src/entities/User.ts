import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface UserExportData {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  created_at: Date;
  updated_at: Date;
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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  public getData(): UserExportData {
    return {
      id: this.ssoId,
      name: this.name,
      email: this.email,
      avatar: this.avatar,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
