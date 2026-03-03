import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostEntity } from '@/entities';
import { PageEntity } from '@/entities';

@Injectable()
export class SeoService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(PostEntity)
    private readonly postRepository: Repository<PostEntity>,
    @InjectRepository(PageEntity)
    private readonly pageRepository: Repository<PageEntity>,
  ) {}

  private get frontUrl(): string {
    return this.configService.get<string>(
      'FRONT_URL',
      'https://blog.mitsuha.space',
    );
  }

  async generateSitemap(): Promise<string> {
    const posts = await this.postRepository.find({
      where: { status: 'published' },
      select: ['slug', 'updatedAt'],
    });

    const pages = await this.pageRepository.find({
      where: { status: 'published' },
      select: ['slug', 'updatedAt'],
    });

    const urls: string[] = [];

    // Landing page
    urls.push(
      this.buildUrlEntry(
        `${this.frontUrl}/landing`,
        new Date(),
        'daily',
        '1.0',
      ),
    );

    // Posts list
    urls.push(
      this.buildUrlEntry(`${this.frontUrl}/posts`, new Date(), 'daily', '0.8'),
    );

    // Individual posts
    for (const post of posts) {
      urls.push(
        this.buildUrlEntry(
          `${this.frontUrl}/archives/${post.slug}.html`,
          post.updatedAt,
          'weekly',
          '0.7',
        ),
      );
    }

    // Individual pages
    for (const page of pages) {
      urls.push(
        this.buildUrlEntry(
          `${this.frontUrl}/${page.slug}.html`,
          page.updatedAt,
          'monthly',
          '0.6',
        ),
      );
    }

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls,
      '</urlset>',
    ].join('\n');
  }

  generateRobots(): string {
    const sitemapUrl = `${this.frontUrl}/sitemap.xml`;

    return [
      'User-agent: *',
      'Allow: /',
      'Disallow: /user/',
      'Disallow: /403',
      '',
      `Sitemap: ${sitemapUrl}`,
    ].join('\n');
  }

  private buildUrlEntry(
    loc: string,
    lastmod: Date,
    changefreq: string,
    priority: string,
  ): string {
    const lastmodStr = lastmod.toISOString().split('T')[0];
    return [
      '  <url>',
      `    <loc>${this.escapeXml(loc)}</loc>`,
      `    <lastmod>${lastmodStr}</lastmod>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n');
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
