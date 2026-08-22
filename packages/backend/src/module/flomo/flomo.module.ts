import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  FlomoConfigEntity,
  FlomoPublicMemoEntity,
  FlomoSyncStateEntity,
} from '@/entities';
import { SecretEncryptionModule } from '@/module/secret-encryption/secret-encryption.module';
import { FlomoController } from './flomo.controller';
import { FlomoService } from './flomo.service';
import { FLOMO_SOURCE_ADAPTER } from './flomo-source.types';
import { FlomoWebSourceAdapter } from './flomo-web-source.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FlomoConfigEntity,
      FlomoPublicMemoEntity,
      FlomoSyncStateEntity,
    ]),
    SecretEncryptionModule,
  ],
  controllers: [FlomoController],
  providers: [
    FlomoService,
    FlomoWebSourceAdapter,
    { provide: FLOMO_SOURCE_ADAPTER, useExisting: FlomoWebSourceAdapter },
  ],
  exports: [FlomoService],
})
export class FlomoModule {}
