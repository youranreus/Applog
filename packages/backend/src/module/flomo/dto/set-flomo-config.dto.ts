import {
  FLOMO_MAX_PUBLICATION_TAG_LENGTH,
  FLOMO_MAX_PUBLICATION_TAGS,
  FLOMO_MAX_TOKEN_LENGTH,
} from '@applog/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsString,
  MaxLength,
} from 'class-validator';

export class SetFlomoConfigDto {
  @IsString({ message: 'token 必须是字符串' })
  @MaxLength(FLOMO_MAX_TOKEN_LENGTH, { message: 'token 过长' })
  token: string;

  @IsArray({ message: 'publicationTags 必须是字符串数组' })
  @ArrayMaxSize(FLOMO_MAX_PUBLICATION_TAGS, { message: '发布标签数量过多' })
  @IsString({ each: true, message: '发布标签必须是字符串' })
  @MaxLength(FLOMO_MAX_PUBLICATION_TAG_LENGTH + 2, {
    each: true,
    message: '发布标签过长',
  })
  publicationTags: string[];

  @IsBoolean({ message: 'enabled 必须是布尔值' })
  enabled: boolean;
}
