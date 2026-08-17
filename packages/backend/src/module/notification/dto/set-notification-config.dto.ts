import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class SetNotificationConfigDto {
  @IsString({ message: 'mailToken 必须是字符串' })
  @MaxLength(4096, { message: 'mailToken 过长' })
  mailToken: string;

  @IsBoolean({ message: 'enabled 必须是布尔值' })
  enabled: boolean;
}
