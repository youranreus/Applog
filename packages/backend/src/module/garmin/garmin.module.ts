import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GarminActivitySnapshotEntity,
  GarminSyncStateEntity,
  GarminActivityCoverEntity,
} from '@/entities';
import { GarminController } from './garmin.controller';
import { GarminService } from './garmin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GarminActivitySnapshotEntity,
      GarminSyncStateEntity,
      GarminActivityCoverEntity,
    ]),
  ],
  controllers: [GarminController],
  providers: [GarminService],
})
export class GarminModule {}
