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

  console.log('Seed complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
