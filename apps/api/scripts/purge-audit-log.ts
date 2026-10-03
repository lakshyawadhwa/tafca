/**
 * Deletes audit entries past the retention window.
 *
 * The window itself is enforced by a database trigger, not by this script —
 * running it with a wrong date, or pointing it at the whole table, still cannot
 * remove anything inside the window. That is deliberate: the guarantee should
 * not depend on this file being correct.
 *
 * Not scheduled. There is no job runner in V1, so this is run by hand or wired
 * to whatever scheduler exists when one is added. Nothing breaks if it is never
 * run for years — it only reclaims space.
 *
 *   pnpm --filter api db:purge-audit            # report only
 *   pnpm --filter api db:purge-audit -- --apply # actually delete
 */
import { PrismaClient } from '@prisma/client';

const RETENTION_YEARS = 8;

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);

  try {
    const expired = await prisma.userActionLog.count({
      where: { occurredAt: { lt: cutoff } },
    });
    const total = await prisma.userActionLog.count();

    console.log(`Retention: ${RETENTION_YEARS} years (cutoff ${cutoff.toISOString().slice(0, 10)})`);
    console.log(`Entries: ${total} total, ${expired} past the window`);

    if (expired === 0) {
      console.log('Nothing to purge.');
      return;
    }

    if (!apply) {
      console.log('Dry run. Re-run with --apply to delete.');
      return;
    }

    const { count } = await prisma.userActionLog.deleteMany({
      where: { occurredAt: { lt: cutoff } },
    });
    console.log(`Deleted ${count} entries.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
