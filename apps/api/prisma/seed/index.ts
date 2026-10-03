import { PrismaClient } from '@prisma/client';
import { seedEngagementTypes } from './engagement-types';
import { seedStatutoryDeadlines } from './statutory-deadlines';
import { seedTaskTemplates } from './task-templates';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding global data...');

  const systemUserId = '00000000-0000-0000-0000-000000000000'; // system user

  await seedEngagementTypes(prisma, systemUserId);
  await seedStatutoryDeadlines(prisma);
  await seedTaskTemplates(prisma, systemUserId);
  // Role permissions are intentionally NOT seeded. The code matrix in
  // DEFAULT_ROLE_PERMISSIONS governs every firm, and PermissionService falls
  // back to it when a firm has no rows. Seeding rows here would reintroduce the
  // two-sources-of-truth problem that migration 20261003060000 removed.

  console.log('Seed complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
