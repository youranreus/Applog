/**
 * 数据迁移相关类型定义
 */

/**
 * 支持的数据迁移源类型
 */
export type MigrationSourceType = 'typecho';

/**
 * 迁移结果统计信息
 */
export interface IMigrationResult {
  /** 用户迁移数量 */
  usersCount: number;
  /** 文章迁移数量 */
  postsCount: number;
  /** 页面迁移数量 */
  pagesCount: number;
  /** 评论迁移数量 */
  commentsCount: number;
  /** 迁移是否成功 */
  success: boolean;
  /** 错误信息（如果失败） */
  error?: string;
  /** 迁移耗时（毫秒） */
  duration: number;
}

/**
 * 数据库连接配置
 */
export interface IDatabaseConfig {
  /** 数据库主机 */
  host: string;
  /** 数据库端口 */
  port: number;
  /** 数据库用户名 */
  username: string;
  /** 数据库密码 */
  password: string;
  /** 数据库名称 */
  database: string;
  /** 表前缀（如 typecho_ ） */
  tablePrefix?: string;
}

/**
 * Typecho 用户原始数据
 */
export interface ITypechoUser {
  uid: number;
  name: string;
  password: string;
  mail: string;
  url?: string;
  screenName: string;
  created: number;
  activated: number;
  logged: number;
  group: string;
  authCode?: string;
}

/**
 * Typecho 内容原始数据（文章/页面）
 */
export interface ITypechoContent {
  cid: number;
  title: string;
  slug: string;
  created: number;
  modified: number;
  text: string;
  order: number;
  authorId: number;
  template?: string;
  type: 'post' | 'page';
  status: 'publish' | 'draft' | 'hidden' | 'private';
  password?: string;
  commentsNum: number;
  allowComment: '0' | '1';
  allowPing: '0' | '1';
  allowFeed: '0' | '1';
  parent: number;
}

/**
 * Typecho 评论原始数据
 */
export interface ITypechoComment {
  coid: number;
  cid: number;
  created: number;
  author: string;
  authorId: number;
  ownerId: number;
  mail: string;
  url?: string;
  ip?: string;
  agent?: string;
  text: string;
  type: string;
  status: 'approved' | 'waiting' | 'spam';
  parent: number;
}

/**
 * Typecho 标签/分类元数据
 */
export interface ITypechoMeta {
  mid: number;
  name: string;
  slug: string;
  type: 'category' | 'tag';
  description?: string;
  count: number;
  order: number;
  parent: number;
}

/**
 * Typecho 内容与元数据关系
 */
export interface ITypechoRelationship {
  cid: number;
  mid: number;
}
