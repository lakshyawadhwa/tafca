import { PrismaClient } from '@prisma/client';
import { flattenDefaultPermissions } from '@ca-practice-os/shared';

/**
 * Populate firm_role_permissions for every existing firm using defaults from shared.
 * Idempotent via skipDuplicates on the (firm_id, role, resource, action) unique index.
 */
export async function seedFirmRolePermissions(prisma: PrismaClient) {
  const firms = await prisma.firm.findMany({ select: { id: true } });
  if (firms.length === 0) return;

  const defaults = flattenDefaultPermissions();
  const rows = firms.flatMap((firm) =>
    defaults.map((p) => ({
      firmId: firm.id,
      role: p.role,
      resource: p.resource,
      action: p.action,
      scope: p.scope,
    })),
  );

  const result = await prisma.firmRolePermission.createMany({
    data: rows,
    skipDuplicates: true,
  });
  console.log(
    `Seeded ${result.count} firm role permissions across ${firms.length} firm(s).`,
  );
}
