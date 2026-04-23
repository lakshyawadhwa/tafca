/**
 * Test auth helpers: register a firm+user, return access token.
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';

let counter = 0;

function uniqueSuffix(): string {
  return `${Date.now()}_${++counter}`;
}

export interface TestUser {
  accessToken: string;
  userId: string;
  firmId: string;
}

/**
 * Register a new firm + user and return the access token.
 * Each call uses a unique email to avoid conflicts.
 */
export async function registerTestUser(app: INestApplication): Promise<TestUser> {
  const suffix = uniqueSuffix();
  const email = `test_${suffix}@example.com`;

  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({
      email,
      password: 'TestPassword123!',
      fullName: 'Test User',
      firmName: `Test Firm ${suffix}`,
    })
    .expect(201);

  return {
    accessToken: res.body.accessToken,
    userId: res.body.user.id,
    firmId: res.body.user.firmId,
  };
}
