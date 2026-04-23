/**
 * Creates a test NestJS app instance with real DB + Redis.
 * Requires TEST_DATABASE_URL or DATABASE_URL to be set.
 * Redis must be running on localhost:6379 (same as docker-compose).
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';

let _app: INestApplication | null = null;

export async function getTestApp(): Promise<INestApplication> {
  if (_app) return _app;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');
  await app.init();

  _app = app;
  return app;
}

export async function closeTestApp(): Promise<void> {
  if (_app) {
    await _app.close();
    _app = null;
  }
}
