import { ArrayNotEmpty, IsArray, IsString, MaxLength } from 'class-validator';

/**
 * 批量获取配置项 DTO
 */
export class BatchConfigDto {
  @IsArray()
  @ArrayNotEmpty({ message: '配置 key 列表不能为空' })
  @IsString({ each: true, message: '配置 key 必须为字符串' })
  @MaxLength(255, {
    each: true,
    message: '配置 key 最多 255 个字符',
  })
  keys: string[];
}
