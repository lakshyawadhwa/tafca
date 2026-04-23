import { UserRole } from '@ca-practice-os/shared';
import { PermissionService, PermissionActor } from './permission.service';

type FindUniqueFn = jest.Mock<Promise<{ scope: string } | null>, [any]>;

function makeService(findUnique: FindUniqueFn) {
  const prisma = {
    unscoped: { firmRolePermission: { findUnique } },
  } as any;
  return new PermissionService(prisma);
}

const actor = (role: UserRole): PermissionActor => ({
  id: 'user-1',
  firmId: 'firm-1',
  role,
});

describe('PermissionService', () => {
  describe('defaults fallback (no DB override)', () => {
    let findUnique: FindUniqueFn;
    let svc: PermissionService;

    beforeEach(() => {
      findUnique = jest.fn().mockResolvedValue(null);
      svc = makeService(findUnique);
    });

    it('PARTNER can create clients (scope all)', async () => {
      await expect(svc.can(actor(UserRole.PARTNER), 'client', 'create')).resolves.toBe(true);
    });

    it('ARTICLE cannot create clients', async () => {
      await expect(svc.can(actor(UserRole.ARTICLE), 'client', 'create')).resolves.toBe(false);
    });

    it('ARTICLE can view an assigned client', async () => {
      await expect(
        svc.can(actor(UserRole.ARTICLE), 'client', 'view', {
          assigneeIds: ['user-1', 'user-9'],
        }),
      ).resolves.toBe(true);
    });

    it('ARTICLE cannot view a client they are not assigned to', async () => {
      await expect(
        svc.can(actor(UserRole.ARTICLE), 'client', 'view', {
          assigneeIds: ['user-2', 'user-3'],
        }),
      ).resolves.toBe(false);
    });

    it('ARTICLE cannot view a client when no subject provided (scope assigned)', async () => {
      await expect(
        svc.can(actor(UserRole.ARTICLE), 'client', 'view'),
      ).resolves.toBe(false);
    });

    it('JUNIOR_CA can edit their own task', async () => {
      await expect(
        svc.can(actor(UserRole.JUNIOR_CA), 'task', 'edit', { ownerId: 'user-1' }),
      ).resolves.toBe(true);
    });

    it('JUNIOR_CA cannot edit someone else\'s task', async () => {
      await expect(
        svc.can(actor(UserRole.JUNIOR_CA), 'task', 'edit', { ownerId: 'user-2' }),
      ).resolves.toBe(false);
    });

    it('ARTICLE has no credentials permission at all', async () => {
      await expect(
        svc.can(actor(UserRole.ARTICLE), 'credentials', 'view', {
          assigneeIds: ['user-1'],
        }),
      ).resolves.toBe(false);
    });

    it('ADMIN can delete any comment (scope all overrides own)', async () => {
      await expect(
        svc.can(actor(UserRole.ADMIN), 'comment', 'delete', { ownerId: 'someone-else' }),
      ).resolves.toBe(true);
    });
  });

  describe('DB override wins over defaults', () => {
    it('grants a permission that is denied by default', async () => {
      const findUnique: FindUniqueFn = jest.fn().mockResolvedValue({ scope: 'all' });
      const svc = makeService(findUnique);

      await expect(
        svc.can(actor(UserRole.ARTICLE), 'client', 'create'),
      ).resolves.toBe(true);
    });

    it('narrows an "all" scope to "own"', async () => {
      const findUnique: FindUniqueFn = jest.fn().mockResolvedValue({ scope: 'own' });
      const svc = makeService(findUnique);

      await expect(
        svc.can(actor(UserRole.PARTNER), 'task', 'delete', { ownerId: 'user-2' }),
      ).resolves.toBe(false);
      await expect(
        svc.can(actor(UserRole.PARTNER), 'task', 'delete', { ownerId: 'user-1' }),
      ).resolves.toBe(true);
    });

    it('treats unknown scope value as denied', async () => {
      const findUnique: FindUniqueFn = jest.fn().mockResolvedValue({ scope: 'garbage' });
      const svc = makeService(findUnique);

      await expect(
        svc.can(actor(UserRole.PARTNER), 'client', 'view'),
      ).resolves.toBe(false);
    });
  });

  describe('caching', () => {
    it('memoizes results per (firm, role, resource, action)', async () => {
      const findUnique: FindUniqueFn = jest.fn().mockResolvedValue(null);
      const svc = makeService(findUnique);

      await svc.can(actor(UserRole.PARTNER), 'client', 'view');
      await svc.can(actor(UserRole.PARTNER), 'client', 'view');
      await svc.can(actor(UserRole.PARTNER), 'client', 'view');

      expect(findUnique).toHaveBeenCalledTimes(1);
    });

    it('invalidate(firmId) clears only that firm\'s entries', async () => {
      const findUnique: FindUniqueFn = jest.fn().mockResolvedValue(null);
      const svc = makeService(findUnique);

      await svc.can(actor(UserRole.PARTNER), 'client', 'view');
      await svc.can({ ...actor(UserRole.PARTNER), firmId: 'firm-2' }, 'client', 'view');
      expect(findUnique).toHaveBeenCalledTimes(2);

      svc.invalidate('firm-1');
      await svc.can(actor(UserRole.PARTNER), 'client', 'view');
      await svc.can({ ...actor(UserRole.PARTNER), firmId: 'firm-2' }, 'client', 'view');

      // firm-1 refetched (call 3), firm-2 still cached
      expect(findUnique).toHaveBeenCalledTimes(3);
    });
  });
});
