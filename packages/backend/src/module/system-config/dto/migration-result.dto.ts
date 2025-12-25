/**
 * 数据迁移结果响应 DTO 接口
 */
export interface IMigrationResultDto {
  /** 迁移是否成功 */
  success: boolean;
  /** 提示消息 */
  message: string;
  /** 用户迁移数量 */
  usersCount: number;
  /** 文章迁移数量 */
  postsCount: number;
  /** 页面迁移数量 */
  pagesCount: number;
  /** 评论迁移数量 */
  commentsCount: number;
  /** 迁移耗时（毫秒） */
  duration: number;
  /** 错误信息（如果失败） */
  error?: string;
}
