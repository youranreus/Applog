import { Module } from '@nestjs/common';
import { VisitorCursorController } from './visitor-cursor.controller';
import { VisitorCursorService } from './visitor-cursor.service';

@Module({
  controllers: [VisitorCursorController],
  providers: [VisitorCursorService],
})
export class VisitorCursorModule {}
