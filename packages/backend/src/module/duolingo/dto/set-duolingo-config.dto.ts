import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class SetDuolingoConfigDto {
  @IsString({ message: 'username 必须是字符串' })
  @MaxLength(128, { message: 'username 过长' })
  username: string;

  @IsString({ message: 'jwt 必须是字符串' })
  @MaxLength(4096, { message: 'jwt 过长' })
  jwt: string;

  @IsString({ message: 'timeZone 必须是字符串' })
  @MaxLength(128, { message: 'timeZone 过长' })
  timeZone: string;

  @IsBoolean({ message: 'enabled 必须是布尔值' })
  enabled: boolean;
}
