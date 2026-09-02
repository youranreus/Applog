import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import type { ITokscaleLandingStats } from '@applog/common';
import { TokscaleService } from './tokscale.service';

@Controller({ path: 'tokscale', version: [VERSION_NEUTRAL, '1'] })
export class TokscaleController {
  constructor(private readonly tokscaleService: TokscaleService) {}

  @Get('stats')
  getStats(): ITokscaleLandingStats | null {
    return this.tokscaleService.getLandingStats();
  }
}
