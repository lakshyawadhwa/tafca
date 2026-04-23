/**
 * Task API integration tests.
 * Covers AC-7 (search query param), AC-9 (checklist cap).
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { getTestApp, closeTestApp } from './helpers/app';
import { registerTestUser, TestUser } from './helpers/auth';
import { getTestPrisma, truncateAll, TEST_DB_AVAILABLE } from './helpers/test-db';
import { PrismaClient } from '@prisma/client';

const describeIf = TEST_DB_AVAILABLE ? describe : describe.skip;

describeIf('Task API (e2e)', () => {
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

  // ─── AC-7: Task search query param ───────────────────────────────────────

  describe('GET /api/tasks?search= (AC-7)', () => {
    it('returns matching tasks case-insensitively', async () => {
      // Create 3 tasks
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'GST Filing April', description: 'Monthly GST' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'TDS Return Q4', description: 'Quarterly TDS' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'GST Annual Return', description: 'Annual' })
        .expect(201);

      // Search for "gst" (lowercase) — should match 2 tasks
      const res = await request(app.getHttpServer())
        .get('/api/tasks?search=gst')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(
        res.body.data.every((t: any) =>
          t.title.toLowerCase().includes('gst'),
        ),
      ).toBe(true);
    });

    it('returns empty array when no match', async () => {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'TDS Return' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/tasks?search=xyz_nomatch')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(0);
    });

    it('respects firm scope (AC-7)', async () => {
      const user2 = await registerTestUser(app);

      // user1 creates a task
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'Shared Search Term Audit' })
        .expect(201);

      // user2 searches — should NOT see user1's task
      const res = await request(app.getHttpServer())
        .get('/api/tasks?search=Audit')
        .set('Authorization', `Bearer ${user2.accessToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(0);
    });
  });

  // ─── AC-9: Checklist 30-item cap ─────────────────────────────────────────

  describe('POST /api/tasks/:id/checklist (AC-9)', () => {
    let taskId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'Checklist Test Task' })
        .expect(201);
      taskId = res.body.id;
    });

    it('allows adding up to 30 checklist items', async () => {
      for (let i = 0; i < 30; i++) {
        await request(app.getHttpServer())
          .post(`/api/tasks/${taskId}/checklist`)
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({ label: `Item ${i + 1}`, isRequired: false })
          .expect(201);
      }
    });

    it('rejects 31st item with 400 (AC-9)', async () => {
      // Add 30 items
      for (let i = 0; i < 30; i++) {
        await request(app.getHttpServer())
          .post(`/api/tasks/${taskId}/checklist`)
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({ label: `Item ${i + 1}`, isRequired: false })
          .expect(201);
      }

      // 31st should fail
      const res = await request(app.getHttpServer())
        .post(`/api/tasks/${taskId}/checklist`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ label: 'Item 31', isRequired: false })
        .expect(400);

      expect(res.body.message).toMatch(/30|checklist.*exceed|maximum/i);
    });
  });
});
