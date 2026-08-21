import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class SetWakaTimeConfigDto {
  @IsString({ message: 'apiKey 必须是字符串' })
  @MaxLength(4096, { message: 'apiKey 过长' })
  apiKey: string;

  @IsString({ message: 'timeZone 必须是字符串' })
  @MaxLength(128, { message: 'timeZone 过长' })
  timeZone: string;

  @IsBoolean({ message: 'enabled 必须是布尔值' })
  enabled: boolean;
}
