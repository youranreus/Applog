import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { VERSION_NEUTRAL, VersioningType } from '@nestjs/common';
import {
  TransformInterceptor,
  AllExceptionsFilter,
  HttpExceptionFilter,
} from '@reus-able/nestjs';
import multipart from '@fastify/multipart';
import { GALLERY_MAX_FILE_SIZE } from '@applog/common';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(multipart as never, {
    limits: { files: 1, fileSize: GALLERY_MAX_FILE_SIZE, fields: 0 },
  });

  app.enableVersioning({
    defaultVersion: [VERSION_NEUTRAL, '1'],
    type: VersioningType.URI,
  });

  app.enableCors({
    origin: process.env.FRONT_URL || 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  await app.listen(4000, '0.0.0.0');
}
bootstrap();
