/**
 * 文章基础信息 DTO（用于 BBCode article 标签）
 * 仅包含必要的展示信息，减少数据传输量
 */
export interface IPostBasicInfoDto {
  /** 文章 slug */
  slug: string;
  /** 文章标题 */
  title: string;
  /** 发布日期 */
  createdAt: Date;
}
