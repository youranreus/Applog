import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { PostEntity } from '@/entities';
import { CommentModule } from '../comment/comment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostEntity]),
    CommentModule, // 导入 CommentModule 以便 PostService 可以使用 CommentService
  ],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
