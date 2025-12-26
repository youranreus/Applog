import {
  IsEnum,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 数据库连接配置
 */
export interface IDatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  tablePrefix?: string;
}

/**
 * 数据库连接配置 DTO
 */
export class DatabaseConfigDto implements IDatabaseConfig {
  @IsString()
  host: string;

  @IsNumber()
  port: number;

  @IsString()
  database: string;

  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  tablePrefix?: string;
}

/**
 * 迁移源类型
 */
export type MigrationSource = 'typecho';

/**
 * 迁移数据请求 DTO
 */
export class MigrateDataDto {
  /**
   * 数据源类型，目前仅支持 'typecho'
   */
  @IsEnum(['typecho'])
  source: MigrationSource;

  /**
   * 数据库连接配置
   */
  @ValidateNested()
  @Type(() => DatabaseConfigDto)
  dbConfig: DatabaseConfigDto;

  /**
   * 是否清空现有数据（可选，默认 false）
   */
  @IsOptional()
  @IsBoolean()
  clearExisting?: boolean;
}

/**
 * 迁移统计数据
 */
export interface IMigrationStats {
  postsImported: number;
  pagesImported: number;
  postsFailed: number;
  pagesFailed: number;
  duration: string;
}

/**
 * 迁移结果响应 DTO
 */
export interface IMigrationResultDto {
  success: boolean;
  message: string;
  data: IMigrationStats;
}

/**
 * Typecho 原始文章数据
 */
export interface IRawPost {
  cid: number;
  title: string;
  slug: string;
  created: number;
  modified: number;
  text: string;
  type: string;
  status: string;
  authorId: number;
  authorEmail?: string;
}

/**
 * Typecho 原始页面数据
 */
export interface IRawPage {
  cid: number;
  title: string;
  slug: string;
  created: number;
  modified: number;
  text: string;
  type: string;
  status: string;
  authorId: number;
  authorEmail?: string;
}

