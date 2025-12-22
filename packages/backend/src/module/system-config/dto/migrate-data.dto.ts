import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import type { MigrationSourceType } from '../migration/types';

/**
 * 数据迁移请求 DTO
 */
export class MigrateDataDto {
  /**
   * 迁移源类型，目前支持：typecho
   */
  @IsString()
  @IsNotEmpty({ message: '迁移源类型不能为空' })
  sourceType: MigrationSourceType;

  /**
   * 源数据库主机地址
   */
  @IsString()
  @IsNotEmpty({ message: '数据库主机地址不能为空' })
  host: string;

  /**
   * 源数据库端口
   */
  @IsNumber({}, { message: '数据库端口必须是数字' })
  port: number;

  /**
   * 源数据库用户名
   */
  @IsString()
  @IsNotEmpty({ message: '数据库用户名不能为空' })
  username: string;

  /**
   * 源数据库密码
   */
  @IsString()
  @IsNotEmpty({ message: '数据库密码不能为空' })
  password: string;

  /**
   * 源数据库名称
   */
  @IsString()
  @IsNotEmpty({ message: '数据库名称不能为空' })
  database: string;

  /**
   * 数据库表前缀（可选，默认根据源类型自动设置）
   */
  @IsString()
  @IsOptional()
  tablePrefix?: string;
}
