import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface SystemConfigExportData {
  id: number;
  configKey: string;
  configValue: string;
  description?: string;
  extra?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

@Entity({
  name: 'system_configs',
})
export class SystemConfigEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: false,
    comment: '配置项唯一 key',
  })
  configKey: string;

  @Column({
    type: 'text',
    nullable: false,
    comment: '配置项值，统一存储为字符串',
  })
  configValue: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '配置项说明',
  })
  description?: string;

  @Column({
    type: 'json',
    nullable: true,
    comment: '额外信息，例如配置的结构描述',
  })
  extra?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public getData(): SystemConfigExportData {
    return {
      id: this.id,
      configKey: this.configKey,
      configValue: this.configValue,
      description: this.description,
      extra: this.extra,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
