import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsObject,
} from 'class-validator';

/**
 * 设置或创建配置项 DTO
 */
export class SetConfigDto {
  @IsString()
  @IsNotEmpty({ message: '配置 key 不能为空' })
  @MaxLength(255, { message: '配置 key 最多 255 个字符' })
  configKey: string;

  @IsString()
  @IsNotEmpty({ message: '配置值不能为空' })
  configValue: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: '描述最多 500 个字符' })
  description?: string;

  @IsObject()
  @IsOptional()
  extra?: Record<string, unknown>;
}
