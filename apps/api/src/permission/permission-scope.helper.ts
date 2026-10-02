import { ForbiddenException } from '@nestjs/common';
import { Scope, UserRole } from '@ca-practice-os/shared';
import { getRequestContext } from '../common/context/request-context';
import { PermissionService } from './permission.service';

/**
 * Translates a resolved permission scope into the two things services need:
 * a `where` fragment for list queries, and an access check for a single record.
 *
 * Firm isolation is NOT handled here — the Prisma extension already applies
 * firm_id to every query. This is the second layer: which records inside the
 * firm this particular user may see or touch.
 */

export interface ActorContext {
  id: string;
  firmId: string;
  role: UserRole;
}

export function currentActor(): ActorContext {
  const ctx = getRequestContext();
  return { id: ctx.userId, firmId: ctx.firmId, role: ctx.role as UserRole };
}

/** A client is "assigned" to whoever holds one of its four role slots. */
export function clientScopeWhere(scope: Scope, actorId: string): Record<string, any> | null {
  if (scope === 'all') return null;
  if (scope === 'own') return { createdBy: actorId };
  return {
    OR: [
      { assignedPartnerId: actorId },
      { assignedManagerId: actorId },
      { assignedJuniorId: actorId },
      { assignedArticleId: actorId },
    ],
  };
}

/** A task is "assigned" to its assignee or reviewer; "own" means created by. */
export function taskScopeWhere(scope: Scope, actorId: string): Record<string, any> | null {
  if (scope === 'all') return null;
  if (scope === 'own') return { createdBy: actorId };
  return {
    OR: [
      { assigneeId: actorId },
      { reviewerId: actorId },
      { createdBy: actorId },
    ],
  };
}

/**
 * An engagement is visible when the user holds one of its slots, or is on the
 * assigned client. Kept to the engagement's own columns to avoid a join here.
 */
export function engagementScopeWhere(scope: Scope, actorId: string): Record<string, any> | null {
  if (scope === 'all') return null;
  if (scope === 'own') return { createdBy: actorId };
  return {
    OR: [
      { assignedPartnerId: actorId },
      { assignedManagerId: actorId },
      {
        client: {
          OR: [
            { assignedPartnerId: actorId },
            { assignedManagerId: actorId },
            { assignedJuniorId: actorId },
            { assignedArticleId: actorId },
          ],
        },
      },
    ],
  };
}

/**
 * Merges a scope fragment into an existing where clause without letting a
 * caller-supplied `OR` silently widen it.
 */
export function withScope(
  where: Record<string, any>,
  scopeWhere: Record<string, any> | null,
): Record<string, any> {
  if (!scopeWhere) return where;
  const existing = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
  return { ...where, AND: [...existing, scopeWhere] };
}

/**
 * Record-level check for 'assigned' / 'own' scopes. Throws rather than
 * returning false so callers read as a guard clause.
 */
export async function assertCanAccess(
  permissionService: PermissionService,
  actor: ActorContext,
  resource: Parameters<PermissionService['can']>[1],
  action: Parameters<PermissionService['can']>[2],
  subject: { ownerId?: string | null; assigneeIds?: Array<string | null | undefined> },
): Promise<void> {
  const allowed = await permissionService.can(actor, resource, action, subject);
  if (!allowed) {
    throw new ForbiddenException(
      `Role '${actor.role}' cannot ${action} this ${resource}`,
    );
  }
}
