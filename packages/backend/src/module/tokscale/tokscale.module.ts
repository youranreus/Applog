import { Module } from '@nestjs/common';
import { SystemConfigModule } from '@/module/system-config/system-config.module';
import { TokscaleClient } from './tokscale.client';
import { TokscaleController } from './tokscale.controller';
import { TokscaleService } from './tokscale.service';

@Module({
  imports: [SystemConfigModule],
  controllers: [TokscaleController],
  providers: [TokscaleClient, TokscaleService],
  exports: [TokscaleService],
})
export class TokscaleModule {}
