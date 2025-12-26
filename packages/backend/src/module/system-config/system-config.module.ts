import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SystemConfigEntity,
  PostEntity,
  PageEntity,
  UserEntity,
} from '@/entities';
import { SystemConfigService } from './system-config.service';
import { MigrationService } from './migration.service';
import { SystemConfigController } from './system-config.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemConfigEntity,
      PostEntity,
      PageEntity,
      UserEntity,
    ]),
  ],
  controllers: [SystemConfigController],
  providers: [SystemConfigService, MigrationService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
