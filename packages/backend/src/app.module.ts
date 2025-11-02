import { Module, ValidationPipe } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ENV_LIST } from '@/utils/const';
import { AuthGuard, BusinessException, LoggerModule } from '@reus-able/nestjs';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { UserModule, PostModule, CommentModule } from '@/module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTITY_LIST } from '@/entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [...ENV_LIST],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (cfg: ConfigService) => ({
        type: 'mysql',
        host: cfg.get('MYSQL_SERVER', 'localhost'),
        port: cfg.get<number>('MYSQL_PORT', 3306),
        username: cfg.get('MYSQL_USER', 'root'),
        password: cfg.get('MYSQL_PASSWORD', 'root'),
        database: cfg.get('MYSQL_DATABASE', 'ware-house'),
        synchronize: true,
        entities: [...ENTITY_LIST],
      }),
    }),
    LoggerModule,
    UserModule,
    PostModule,
    CommentModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useFactory() {
        return new ValidationPipe({
          transform: true,
          transformOptions: {
            enableImplicitConversion: true, // 开启隐式转换
          },
          exceptionFactory: (errors) => {
            const errorProperties = errors.map((e) => e.property).join(',');
            return new BusinessException(
              `参数校验失败，请检查 ${errorProperties}`,
            );
          },
        });
      },
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
