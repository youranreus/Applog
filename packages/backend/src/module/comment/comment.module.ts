import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CommentEntity, PostEntity, SystemConfigEntity } from '@/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([CommentEntity, PostEntity, SystemConfigEntity]),
  ],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
