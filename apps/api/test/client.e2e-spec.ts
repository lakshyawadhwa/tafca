/**
 * Client API integration tests.
 * Covers AC-3 (display_name case-insensitive uniqueness),
 * AC-4/5 (GSTIN validation), AC-2 (PAN required for non-INDIVIDUAL).
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { getTestApp, closeTestApp } from './helpers/app';
import { registerTestUser, TestUser } from './helpers/auth';
import { getTestPrisma, truncateAll, TEST_DB_AVAILABLE } from './helpers/test-db';
import { PrismaClient } from '@prisma/client';

const describeIf = TEST_DB_AVAILABLE ? describe : describe.skip;

describeIf('Client API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let user: TestUser;

  beforeAll(async () => {
    prisma = getTestPrisma();
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    user = await registerTestUser(app);
  });

  // ─── AC-2: PAN required for non-INDIVIDUAL ───────────────────────────────

  describe('POST /api/clients - PAN validation', () => {
    it('AC-2: rejects missing PAN for PRIVATE_LIMITED (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          displayName: 'Test Corp',
          entityType: 'PRIVATE_LIMITED',
          // no pan
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('AC-2: accepts missing PAN for INDIVIDUAL', async () => {
      await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          displayName: 'Ramesh Kumar',
          entityType: 'INDIVIDUAL',
        })
        .expect(201);
    });

    it('AC-1: rejects invalid PAN format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          displayName: 'Test Client',
          entityType: 'INDIVIDUAL',
          pan: 'INVALID',
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('AC-6: rejects non-E.164 phone', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          displayName: 'Test Client Phone',
          entityType: 'INDIVIDUAL',
          primaryContactPhone: '9876543210', // missing + prefix
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('AC-6: accepts E.164 phone', async () => {
      await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          displayName: 'Test Client Phone Valid',
          entityType: 'INDIVIDUAL',
          primaryContactPhone: '+919876543210',
        })
        .expect(201);
    });
  });

  // ─── AC-3: Case-insensitive display_name uniqueness ──────────────────────

  describe('POST /api/clients - display_name uniqueness (AC-3)', () => {
    it('rejects duplicate display_name (same case) → 409', async () => {
      await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ displayName: 'ABC Pvt Ltd', entityType: 'INDIVIDUAL' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ displayName: 'ABC Pvt Ltd', entityType: 'INDIVIDUAL' })
        .expect(409);

      expect(res.body.message).toContain('already exists');
    });

    it('rejects duplicate display_name (different case) → 409', async () => {
      await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ displayName: 'ABC Pvt Ltd', entityType: 'INDIVIDUAL' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ displayName: 'abc pvt ltd', entityType: 'INDIVIDUAL' })
        .expect(409);

      expect(res.body.message).toContain('already exists');
    });

    it('allows same name in different firms', async () => {
      const user2 = await registerTestUser(app);

      await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ displayName: 'Shared Name Corp', entityType: 'INDIVIDUAL' })
        .expect(201);

      // Different firm — should succeed
      await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${user2.accessToken}`)
        .send({ displayName: 'Shared Name Corp', entityType: 'INDIVIDUAL' })
        .expect(201);
    });
  });

  // ─── AC-4, AC-5: GSTIN validation ────────────────────────────────────────

  describe('POST /api/clients/:id/gst-numbers - GSTIN validation', () => {
    let clientId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ displayName: 'GST Test Corp', entityType: 'INDIVIDUAL' })
        .expect(201);
      clientId = res.body.id;
    });

    it('AC-5: rejects invalid GSTIN regex → 400', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/clients/${clientId}/gst-numbers`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          gstin: 'INVALID',
          stateCode: '27',
          registrationType: 'REGULAR',
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('AC-4: rejects GSTIN with mismatched state_code → 400', async () => {
      // GSTIN starts with 27 (Maharashtra) but stateCode says 29 (Karnataka)
      const res = await request(app.getHttpServer())
        .post(`/api/clients/${clientId}/gst-numbers`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          gstin: '27AAPFU0939F1ZV',
          stateCode: '29',
          registrationType: 'REGULAR',
        })
        .expect(400);

      expect(res.body.message).toMatch(/state.*code|mismatch/i);
    });

    it('accepts valid GSTIN with matching state_code', async () => {
      await request(app.getHttpServer())
        .post(`/api/clients/${clientId}/gst-numbers`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          gstin: '27AAPFU0939F1ZV',
          stateCode: '27',
          registrationType: 'REGULAR',
        })
        .expect(201);
    });
  });
});
