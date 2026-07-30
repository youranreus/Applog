import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GarminActivitySnapshotEntity,
  GarminSyncStateEntity,
  GarminActivityCoverEntity,
  GarminHealthDailyEntity,
} from '@/entities';
import { SystemConfigModule } from '@/module/system-config/system-config.module';
import { GarminController } from './garmin.controller';
import { GarminService } from './garmin.service';

@Module({
  imports: [
    SystemConfigModule,
    TypeOrmModule.forFeature([
      GarminActivitySnapshotEntity,
      GarminSyncStateEntity,
      GarminActivityCoverEntity,
      GarminHealthDailyEntity,
    ]),
  ],
  controllers: [GarminController],
  providers: [GarminService],
})
export class GarminModule {}
