import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';
import { PostEntity, PageEntity } from '@/entities';

@Module({
  imports: [TypeOrmModule.forFeature([PostEntity, PageEntity])],
  controllers: [SeoController],
  providers: [SeoService],
})
export class SeoModule {}
