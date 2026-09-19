import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { createValidationPipe } from './common/pipes/validation.pipe';

/**
 * Builds the Nest app with all global wiring (prefix, cookies, CORS, filters, pipes)
 * but does NOT call listen()/init(). Shared by main.ts (long-running server) and
 * serverless.ts (Vercel function) so both paths stay identical.
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.use(cookieParser());

  const corsOrigins = (process.env.APP_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(createValidationPipe());

  return app;
}
