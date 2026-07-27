import { Module } from '@nestjs/common';
import { SystemConfigModule } from '@/module/system-config/system-config.module';
import { DuolingoClient } from './duolingo.client';
import { DuolingoController } from './duolingo.controller';
import { DuolingoService } from './duolingo.service';

@Module({
  imports: [SystemConfigModule],
  controllers: [DuolingoController],
  providers: [DuolingoClient, DuolingoService],
  exports: [DuolingoService],
})
export class DuolingoModule {}
