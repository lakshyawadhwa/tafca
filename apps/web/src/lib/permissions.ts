import {
  DEFAULT_ROLE_PERMISSIONS,
  type Action,
  type Resource,
  type Scope,
  type UserRole,
} from '@ca-practice-os/shared';
import { getUser } from './auth.svelte';

export interface PermissionSubject {
  ownerId?: string | null;
  assigneeIds?: Array<string | null | undefined>;
}

/**
 * FE permission check. Mirrors BE PermissionService semantics using the
 * shared DEFAULT_ROLE_PERMISSIONS matrix. V1 has no per-firm overrides on
 * the FE — gates hide/disable UI; BE re-checks on every call so this is
 * not a security boundary.
 */
export function can(
  resource: Resource,
  action: Action,
  subject?: PermissionSubject,
): boolean {
  const user = getUser();
  if (!user) return false;

  const scope = getScope(user.role, resource, action);
  if (!scope) return false;
  if (scope === 'all') return true;
  if (scope === 'own') return subject?.ownerId === user.id;
  if (scope === 'assigned') {
    return (subject?.assigneeIds ?? []).some((id) => id === user.id);
  }
  return false;
}

export function getScope(
  role: UserRole,
  resource: Resource,
  action: Action,
): Scope | null {
  const key = `${resource}:${action}` as const;
  return DEFAULT_ROLE_PERMISSIONS[role][key] ?? null;
}
