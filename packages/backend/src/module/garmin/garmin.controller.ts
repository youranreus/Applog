import { Controller, Get, Param, Res, VERSION_NEUTRAL } from '@nestjs/common';
import type {
  IGarminLandingActivityDetail,
  IGarminLandingStats,
  IGarminYesterdayStatus,
} from '@applog/common';
import { GarminService } from './garmin.service';

interface GarminCoverReply {
  header(name: string, value: string): GarminCoverReply;
  send(payload: Buffer): void;
}

@Controller({ path: 'garmin', version: [VERSION_NEUTRAL, '1'] })
export class GarminController {
  constructor(private readonly garminService: GarminService) {}

  /** 返回公开 Landing 使用的 Garmin 快照。 */
  @Get('stats')
  getStats(): Promise<IGarminLandingStats | null> {
    return this.garminService.getLandingStats();
  }

  /** Return yesterday's allowlisted health projection without upstream reads. */
  @Get('yesterday')
  getYesterday(): Promise<IGarminYesterdayStatus | null> {
    return this.garminService.getYesterdayStatus();
  }

  /** Lazy public detail lookup by non-source-derived identifier. */
  @Get('activities/:publicId')
  getActivityDetail(
    @Param('publicId') publicId: string,
  ): Promise<IGarminLandingActivityDetail> {
    return this.garminService.getActivityDetail(publicId);
  }

  /** Raw immutable WebP response; bypasses the JSON transform interceptor. */
  @Get('covers/:coverId.webp')
  async getCover(
    @Param('coverId') coverId: string,
    @Res() reply: GarminCoverReply,
  ): Promise<void> {
    const cover = await this.garminService.getCover(coverId);
    reply
      .header('Content-Type', cover.contentType)
      .header('Content-Length', String(cover.byteSize))
      .header('ETag', `"${cover.etag}"`)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(cover.imageData);
  }
}
