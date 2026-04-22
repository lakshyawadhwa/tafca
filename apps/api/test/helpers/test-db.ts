/**
 * Test DB helpers.
 *
 * Uses TEST_DATABASE_URL env var if set, falls back to DATABASE_URL for local dev.
 * Tests that need a real DB will skip gracefully when neither is available.
 *
 * Usage:
 *   import { getTestPrisma, truncateAll } from './test-db';
 *   beforeEach(() => truncateAll(prisma));
 *   afterAll(() => prisma.$disconnect());
 */

import { PrismaClient } from '@prisma/client';

const dbUrl =
  process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];

export const TEST_DB_AVAILABLE = Boolean(dbUrl);

let _prisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!TEST_DB_AVAILABLE) {
    throw new Error(
      'TEST_DATABASE_URL (or DATABASE_URL) not set. Set it to run integration tests.',
    );
  }
  if (!_prisma) {
    _prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
      log: [],
    });
  }
  return _prisma;
}

/**
 * Truncate all application tables between tests.
 * Order matters due to FK constraints — children before parents.
 */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  // Raw SQL is simplest — Prisma doesn't have a truncateMany API
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      task_dependencies,
      task_checklists,
      task_comments,
      task_activity_log,
      tasks,
      document_requests,
      documents,
      engagements,
      client_gst_numbers,
      clients,
      engagement_types,
      notifications,
      user_action_log,
      sessions,
      users,
      firms
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Conditionally skip the entire describe block when no test DB is available.
 * Use in place of describe() for integration test suites.
 */
export function describeWithDb(
  name: string,
  fn: () => void,
): void {
  if (!TEST_DB_AVAILABLE) {
    describe.skip(`${name} [SKIPPED: no test DB]`, fn);
  } else {
    describe(name, fn);
  }
}
