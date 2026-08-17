import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import {
  CommentEntity,
  PageEntity,
  PostEntity,
  SystemConfigEntity,
} from '@/entities';
import { NotificationModule } from '@/module/notification/notification.module';

@Module({
  imports: [
    NotificationModule,
    TypeOrmModule.forFeature([
      CommentEntity,
      PageEntity,
      PostEntity,
      SystemConfigEntity,
    ]),
  ],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
