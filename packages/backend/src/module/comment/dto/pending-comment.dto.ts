import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PendingCapabilityDto {
  @Type(() => Number) @IsInt() @Min(1) commentId: number;
  @IsString() @Length(32, 256) token: string;
}

export class ResolvePendingCommentsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PendingCapabilityDto)
  capabilities: PendingCapabilityDto[];
}

export class WithdrawCommentDto {
  @IsString() @Length(32, 256) token: string;
}
