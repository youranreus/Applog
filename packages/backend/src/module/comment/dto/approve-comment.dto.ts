import { IsEnum } from 'class-validator';

/**
 * 审核评论 DTO
 */
export class ApproveCommentDto {
  @IsEnum(['approved', 'rejected'], {
    message: '审核状态只能是 approved 或 rejected',
  })
  status: 'approved' | 'rejected';
}
