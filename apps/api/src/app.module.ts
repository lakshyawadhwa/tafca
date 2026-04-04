import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { SessionModule } from './session/session.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { FirmScopeGuard } from './auth/guards/firm-scope.guard';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { UserModule } from './user/user.module';
import { ClientModule } from './client/client.module';
import { ActionLogModule } from './action-log/action-log.module';
import { ActionLogInterceptor } from './action-log/action-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    SessionModule,
    AuthModule,
    UserModule,
    ClientModule,
    ActionLogModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: FirmScopeGuard },
    { provide: APP_INTERCEPTOR, useClass: ActionLogInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware, RequestLoggingMiddleware)
      .forRoutes('*');
  }
}
