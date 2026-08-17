import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentEntity, PageEntity, PostEntity, UserEntity } from '@/entities';
import { SystemConfigModule } from '@/module/system-config/system-config.module';
import { NotificationClient } from './notification.client';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    SystemConfigModule,
    TypeOrmModule.forFeature([
      CommentEntity,
      UserEntity,
      PostEntity,
      PageEntity,
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationClient, NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
