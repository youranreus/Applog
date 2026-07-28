import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GarminActivitySnapshotEntity,
  GarminSyncStateEntity,
} from '@/entities';
import { GarminController } from './garmin.controller';
import { GarminService } from './garmin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GarminActivitySnapshotEntity,
      GarminSyncStateEntity,
    ]),
  ],
  controllers: [GarminController],
  providers: [GarminService],
})
export class GarminModule {}
