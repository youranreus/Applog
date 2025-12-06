import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserEntity, PostEntity, PageEntity, CommentEntity } from '@/entities';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  controllers: [UserController],
  providers: [UserService],
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      PostEntity,
      PageEntity,
      CommentEntity,
    ]),
  ],
})
export class UserModule {}
