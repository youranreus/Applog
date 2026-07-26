import { Body, Controller, Post, VERSION_NEUTRAL } from '@nestjs/common';
import { VisitorCursorService } from './visitor-cursor.service';
import { SyncVisitorCursorDto, type IVisitorCursorResponseDto } from './dto';

@Controller({
  path: 'visitor-cursor',
  version: [VERSION_NEUTRAL, '1'],
})
export class VisitorCursorController {
  constructor(private readonly visitorCursorService: VisitorCursorService) {}

  /**
   * 上报当前访客鼠标，并返回同页其他访客。
   * @param dto - 当前访客位置
   * @returns 同页其他访客
   */
  @Post('sync')
  sync(@Body() dto: SyncVisitorCursorDto): IVisitorCursorResponseDto[] {
    return this.visitorCursorService.sync(dto);
  }
}
