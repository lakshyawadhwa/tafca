import { Injectable, Logger } from '@nestjs/common';
import {
  Action,
  Resource,
  Scope,
  UserRole,
  getDefaultScope,
} from '@ca-practice-os/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Subject context used to resolve scoped permissions.
 * - ownerId: the creator / owner of the entity (for 'own' scope)
 * - assigneeIds: users linked to the entity (for 'assigned' scope)
 */
export interface PermissionSubject {
  ownerId?: string | null;
  assigneeIds?: Array<string | null | undefined>;
}

export interface PermissionActor {
  id: string;
  firmId: string;
  role: UserRole;
}

/**
 * Central permission resolver.
 * - DB-first lookup via firm_role_permissions (per-firm overrides, for future admin UI).
 * - Falls back to DEFAULT_ROLE_PERMISSIONS from shared.
 * - Cache is per-instance (invalidated on module restart). Size bounded by
 *   firms × roles × resources × actions ≈ a few thousand rows max in V1.
 */
@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);
  private readonly cache = new Map<string, Scope | null>();

  constructor(private readonly prisma: PrismaService) {}

  private cacheKey(
    firmId: string,
    role: UserRole,
    resource: Resource,
    action: Action,
  ) {
    return `${firmId}:${role}:${resource}:${action}`;
  }

  /**
   * Resolve the effective scope for (firm, role, resource, action).
   * Returns null when denied.
   */
  async getScope(
    firmId: string,
    role: UserRole,
    resource: Resource,
    action: Action,
  ): Promise<Scope | null> {
    const key = this.cacheKey(firmId, role, resource, action);
    if (this.cache.has(key)) return this.cache.get(key)!;

    const row = await this.prisma.unscoped.firmRolePermission.findUnique({
      where: {
        firmId_role_resource_action: {
          firmId,
          role,
          resource,
          action,
        },
      },
      select: { scope: true },
    });

    let scope: Scope | null;
    if (row) {
      scope = this.normalizeScope(row.scope);
    } else {
      scope = getDefaultScope(role, resource, action);
    }

    this.cache.set(key, scope);
    return scope;
  }

  /**
   * Check whether the actor may perform (resource, action) on the subject.
   * Subject is only required when the resolved scope is 'assigned' or 'own'.
   */
  async can(
    actor: PermissionActor,
    resource: Resource,
    action: Action,
    subject?: PermissionSubject,
  ): Promise<boolean> {
    const scope = await this.getScope(actor.firmId, actor.role, resource, action);
    if (!scope) return false;
    if (scope === 'all') return true;
    if (scope === 'own') return !!subject && subject.ownerId === actor.id;
    if (scope === 'assigned') {
      return (
        !!subject &&
        (subject.assigneeIds ?? []).some((id) => id === actor.id)
      );
    }
    return false;
  }

  /**
   * Invalidate cache for a firm — call when firm_role_permissions rows change.
   */
  invalidate(firmId?: string) {
    if (!firmId) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${firmId}:`)) this.cache.delete(key);
    }
  }

  private normalizeScope(raw: string): Scope | null {
    if (raw === 'all' || raw === 'assigned' || raw === 'own') return raw;
    this.logger.warn(`Unknown scope value '${raw}' — treating as denied`);
    return null;
  }
}
