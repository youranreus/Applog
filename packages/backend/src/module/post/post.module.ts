import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { PostEntity, CommentEntity, UserEntity } from '@/entities';

@Module({
  imports: [TypeOrmModule.forFeature([PostEntity, CommentEntity, UserEntity])],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
