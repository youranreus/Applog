import { Controller, Get, VERSION_NEUTRAL, Res } from '@nestjs/common';
import { SeoService } from './seo.service';

@Controller({
  path: '/',
  version: [VERSION_NEUTRAL, '1'],
})
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Get('sitemap.xml')
  async getSitemap(@Res() reply): Promise<void> {
    const xml = await this.seoService.generateSitemap();
    reply
      .header('Content-Type', 'application/xml')
      .header('Cache-Control', 'public, max-age=3600')
      .send(xml);
  }

  @Get('robots.txt')
  getRobots(@Res() reply): void {
    const text = this.seoService.generateRobots();
    reply
      .header('Content-Type', 'text/plain')
      .header('Cache-Control', 'public, max-age=86400')
      .send(text);
  }
}
