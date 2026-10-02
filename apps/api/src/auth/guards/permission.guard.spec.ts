import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@ca-practice-os/shared';
import { PermissionGuard } from './permission.guard';

/**
 * These exist because the permission matrix was fully implemented and never
 * called — PermissionService had no callers outside its own module, so an
 * ARTICLE could delete any client. The matrix's own spec passed throughout.
 * What was missing was a test that something enforces it.
 */

function contextFor(user: unknown) {
  const request: Record<string, unknown> = { user };
  return {
    request,
    ctx: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as any,
  };
}

function guardWith(required: unknown, scope: string | null) {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
  const permissionService = { getScope: jest.fn().mockResolvedValue(scope) } as any;
  return { guard: new PermissionGuard(reflector, permissionService), permissionService };
}

describe('PermissionGuard', () => {
  const actor = { sub: 'u1', firmId: 'f1', role: UserRole.ARTICLE };

  it('denies when the role holds no scope for the permission', async () => {
    const { guard } = guardWith({ resource: 'client', action: 'delete' }, null);
    const { ctx } = contextFor(actor);

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows when a scope resolves, and publishes it for the service layer', async () => {
    const { guard } = guardWith({ resource: 'client', action: 'view' }, 'assigned');
    const { ctx, request } = contextFor(actor);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    // Services read this to narrow list queries.
    expect(request.permissionScope).toBe('assigned');
  });

  it('is inert on routes that declare no permission', async () => {
    const { guard, permissionService } = guardWith(undefined, null);
    const { ctx } = contextFor(actor);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(permissionService.getScope).not.toHaveBeenCalled();
  });

  it('refuses an unauthenticated request on a guarded route', async () => {
    const { guard } = guardWith({ resource: 'client', action: 'view' }, 'all');
    const { ctx } = contextFor(undefined);

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
