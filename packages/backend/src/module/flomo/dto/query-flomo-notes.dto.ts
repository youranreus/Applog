import { IsOptional, IsUUID } from 'class-validator';

export class QueryFlomoNotesDto {
  @IsOptional()
  @IsUUID('4', { message: 'cursor 必须是有效的公开笔记游标' })
  cursor?: string;
}
