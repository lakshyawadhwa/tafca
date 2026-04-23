import { ConflictException, GoneException, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { UserRole } from '@ca-practice-os/shared';
import { InviteService } from './invite.service';

function hashToken(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function makePrisma(overrides: Partial<{
  scopedUserFindFirst: any;
  scopedInviteFindFirst: any;
  scopedInviteCreate: any;
  scopedInviteFindMany: any;
  scopedInviteFindById: any;
  scopedInviteUpdate: any;
  unscopedInviteFindUnique: any;
  unscopedFirmFindUnique: any;
  unscopedUserFindFirst: any;
  unscopedTransaction: any;
}> = {}) {
  const scopedInvite = {
    findFirst: overrides.scopedInviteFindFirst ?? jest.fn(),
    create: overrides.scopedInviteCreate ?? jest.fn(),
    findMany: overrides.scopedInviteFindMany ?? jest.fn().mockResolvedValue([]),
    update: overrides.scopedInviteUpdate ?? jest.fn(),
  };
  // Separate mock for findFirst by id — same method, service calls revoke() via findFirst
  const scoped = {
    user: { findFirst: overrides.scopedUserFindFirst ?? jest.fn().mockResolvedValue(null) },
    invite: scopedInvite,
  };
  const unscoped = {
    invite: { findUnique: overrides.unscopedInviteFindUnique ?? jest.fn() },
    firm: {
      findUniqueOrThrow:
        overrides.unscopedFirmFindUnique ??
        jest.fn().mockResolvedValue({ name: 'Test Firm', displayName: null }),
    },
    user: { findFirst: overrides.unscopedUserFindFirst ?? jest.fn().mockResolvedValue(null) },
    $transaction: overrides.unscopedTransaction ?? jest.fn(),
  };

  const prismaService: any = { scoped, unscoped };

  // Manually patch the service's getter-less access by assigning both properties
  // the FirmScopedService base class exposes `this.prisma` and `this.prismaService`.
  return { prismaService, scoped, unscoped };
}

function makeService(prismaService: any, authService?: any) {
  const config = {
    get: jest.fn().mockReturnValue('http://localhost:5173'),
  } as any;
  const auth = authService ?? ({ issueSession: jest.fn() } as any);
  const svc = new InviteService(prismaService, config, auth);

  // FirmScopedService reads getFirmId / getUserId from AsyncLocalStorage;
  // replace with deterministic test values.
  (svc as any).getFirmId = () => 'firm-1';
  (svc as any).getUserId = () => 'user-inviter';
  return svc;
}

describe('InviteService', () => {
  describe('createInvite', () => {
    it('rejects when a user already exists with that email in the firm', async () => {
      const { prismaService, scoped } = makePrisma({
        scopedUserFindFirst: jest.fn().mockResolvedValue({ id: 'existing-user' }),
      });
      const svc = makeService(prismaService);

      await expect(
        svc.createInvite({ email: 'x@y.com', fullName: 'X Y', role: UserRole.ARTICLE }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(scoped.user.findFirst).toHaveBeenCalled();
    });

    it('rejects when an active invite already exists for the email', async () => {
      const { prismaService } = makePrisma({
        scopedInviteFindFirst: jest.fn().mockResolvedValue({ id: 'pending-1' }),
      });
      const svc = makeService(prismaService);

      await expect(
        svc.createInvite({ email: 'x@y.com', fullName: 'X Y', role: UserRole.ARTICLE }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates invite + returns URL with raw token', async () => {
      const created = {
        id: 'invite-1',
        email: 'x@y.com',
        fullName: 'X Y',
        role: UserRole.ARTICLE,
        expiresAt: new Date('2099-01-01'),
        invitedBy: 'user-inviter',
      };
      const { prismaService } = makePrisma({
        scopedInviteCreate: jest.fn().mockResolvedValue(created),
      });
      const svc = makeService(prismaService);

      const result = await svc.createInvite({
        email: 'X@Y.com', // normalize
        fullName: 'X Y',
        role: UserRole.ARTICLE,
      });

      expect(result.id).toBe('invite-1');
      expect(result.email).toBe('x@y.com'); // normalized
      expect(result.inviteUrl).toMatch(/^http:\/\/localhost:5173\/accept-invite\?token=[a-f0-9]{64}$/);
    });
  });

  describe('findActiveByToken (via preview)', () => {
    it('rejects a token that is too short', async () => {
      const { prismaService } = makePrisma();
      const svc = makeService(prismaService);
      await expect(svc.preview('short')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404s when no invite matches the token', async () => {
      const { prismaService } = makePrisma({
        unscopedInviteFindUnique: jest.fn().mockResolvedValue(null),
      });
      const svc = makeService(prismaService);
      await expect(svc.preview('a'.repeat(64))).rejects.toBeInstanceOf(NotFoundException);
    });

    it('gone when already accepted', async () => {
      const { prismaService } = makePrisma({
        unscopedInviteFindUnique: jest.fn().mockResolvedValue({
          id: 'i',
          firmId: 'firm-1',
          email: 'x@y.com',
          fullName: 'X',
          role: UserRole.ARTICLE,
          tokenHash: hashToken('a'.repeat(64)),
          expiresAt: new Date(Date.now() + 86400000),
          acceptedAt: new Date(),
          revokedAt: null,
          invitedBy: 'u',
        }),
      });
      const svc = makeService(prismaService);
      await expect(svc.preview('a'.repeat(64))).rejects.toBeInstanceOf(GoneException);
    });

    it('gone when revoked', async () => {
      const { prismaService } = makePrisma({
        unscopedInviteFindUnique: jest.fn().mockResolvedValue({
          id: 'i',
          firmId: 'firm-1',
          email: 'x@y.com',
          fullName: 'X',
          role: UserRole.ARTICLE,
          tokenHash: hashToken('a'.repeat(64)),
          expiresAt: new Date(Date.now() + 86400000),
          acceptedAt: null,
          revokedAt: new Date(),
          invitedBy: 'u',
        }),
      });
      const svc = makeService(prismaService);
      await expect(svc.preview('a'.repeat(64))).rejects.toBeInstanceOf(GoneException);
    });

    it('gone when expired', async () => {
      const { prismaService } = makePrisma({
        unscopedInviteFindUnique: jest.fn().mockResolvedValue({
          id: 'i',
          firmId: 'firm-1',
          email: 'x@y.com',
          fullName: 'X',
          role: UserRole.ARTICLE,
          tokenHash: hashToken('a'.repeat(64)),
          expiresAt: new Date(Date.now() - 1000),
          acceptedAt: null,
          revokedAt: null,
          invitedBy: 'u',
        }),
      });
      const svc = makeService(prismaService);
      await expect(svc.preview('a'.repeat(64))).rejects.toBeInstanceOf(GoneException);
    });

    it('returns preview payload when valid', async () => {
      const { prismaService } = makePrisma({
        unscopedInviteFindUnique: jest.fn().mockResolvedValue({
          id: 'i',
          firmId: 'firm-1',
          email: 'x@y.com',
          fullName: 'Alice',
          role: UserRole.MANAGER,
          tokenHash: hashToken('a'.repeat(64)),
          expiresAt: new Date('2099-06-01'),
          acceptedAt: null,
          revokedAt: null,
          invitedBy: 'u',
        }),
        unscopedFirmFindUnique: jest
          .fn()
          .mockResolvedValue({ name: 'Real Firm', displayName: 'Real' }),
      });
      const svc = makeService(prismaService);
      const preview = await svc.preview('a'.repeat(64));
      expect(preview.email).toBe('x@y.com');
      expect(preview.fullName).toBe('Alice');
      expect(preview.role).toBe(UserRole.MANAGER);
      expect(preview.firmName).toBe('Real'); // prefers displayName
    });
  });

  describe('accept', () => {
    it('rejects when a user with same email was created since the invite', async () => {
      const validInvite = {
        id: 'i',
        firmId: 'firm-1',
        email: 'x@y.com',
        fullName: 'X',
        role: UserRole.ARTICLE,
        tokenHash: hashToken('a'.repeat(64)),
        expiresAt: new Date(Date.now() + 86400000),
        acceptedAt: null,
        revokedAt: null,
        invitedBy: 'u',
      };
      const { prismaService } = makePrisma({
        unscopedInviteFindUnique: jest.fn().mockResolvedValue(validInvite),
        unscopedUserFindFirst: jest.fn().mockResolvedValue({ id: 'dup' }),
      });
      const svc = makeService(prismaService);
      await expect(svc.accept('a'.repeat(64), 'password1')).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
