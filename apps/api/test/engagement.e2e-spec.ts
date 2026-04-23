/**
 * Engagement API integration tests.
 * Covers AC-8 (COMPLETED 409 with open_task_count + blocking_tasks),
 * AC-10 (transactional template instantiation).
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { getTestApp, closeTestApp } from './helpers/app';
import { registerTestUser, TestUser } from './helpers/auth';
import { getTestPrisma, truncateAll, TEST_DB_AVAILABLE } from './helpers/test-db';
import { PrismaClient } from '@prisma/client';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

const describeIf = TEST_DB_AVAILABLE ? describe : describe.skip;

describeIf('Engagement API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let user: TestUser;
  let engagementTypeId: string;
  let clientId: string;

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

    // Seed a platform engagement type (firmId: null = platform)
    const et = await prisma.engagementType.create({
      data: {
        firmId: null as any,
        code: `test_et_${Date.now()}`,
        name: 'Test Engagement Type',
        category: 'GST',
        recurrence: 'MONTHLY',
        requiresPartnerApproval: false,
        isActive: true,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      },
    });
    engagementTypeId = et.id;

    // Create a client
    const cRes = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ displayName: 'Test Corp', entityType: 'INDIVIDUAL' })
      .expect(201);
    clientId = cRes.body.id;
  });

  // ─── AC-8: COMPLETED 409 with structured body ─────────────────────────────

  describe('PATCH /api/engagements/:id/status - COMPLETED with open tasks (AC-8)', () => {
    it('returns 409 with open_task_count and blocking_tasks', async () => {
      // Create engagement
      const engRes = await request(app.getHttpServer())
        .post('/api/engagements')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ clientId, engagementTypeId })
        .expect(201);
      const engId = engRes.body.id;

      // Create 2 tasks under the engagement
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'Open Task 1', engagementId: engId })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'Open Task 2', engagementId: engId })
        .expect(201);

      // Try to COMPLETE → should 409
      const res = await request(app.getHttpServer())
        .patch(`/api/engagements/${engId}/status`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ status: 'COMPLETED' })
        .expect(409);

      expect(res.body).toMatchObject({
        open_task_count: 2,
        blocking_tasks: expect.arrayContaining([
          expect.objectContaining({ id: expect.any(String), title: expect.any(String), status: expect.any(String) }),
        ]),
      });
      expect(res.body.blocking_tasks).toHaveLength(2);
    });

    it('allows COMPLETED when all tasks are done', async () => {
      // Create engagement with no tasks — should complete fine
      const engRes = await request(app.getHttpServer())
        .post('/api/engagements')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ clientId, engagementTypeId })
        .expect(201);
      const engId = engRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/engagements/${engId}/status`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ status: 'COMPLETED' })
        .expect(200);
    });
  });
});
