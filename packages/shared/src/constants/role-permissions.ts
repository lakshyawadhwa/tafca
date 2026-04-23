import { UserRole } from '../enums/user-role.enum.js';

export const RESOURCES = [
  'client',
  'engagement',
  'task',
  'checklist',
  'dependency',
  'comment',
  'credentials',
] as const;
export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'assign',
  'status_change',
] as const;
export type Action = (typeof ACTIONS)[number];

export type Scope = 'all' | 'assigned' | 'own';

export type PermissionKey = `${Resource}:${Action}`;
export type RolePermissionMap = Partial<Record<PermissionKey, Scope>>;

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, RolePermissionMap> = {
  [UserRole.PARTNER]: {
    'client:view': 'all',
    'client:create': 'all',
    'client:edit': 'all',
    'client:delete': 'all',
    'engagement:view': 'all',
    'engagement:create': 'all',
    'engagement:edit': 'all',
    'engagement:status_change': 'all',
    'task:view': 'all',
    'task:create': 'all',
    'task:edit': 'all',
    'task:assign': 'all',
    'task:status_change': 'all',
    'task:delete': 'all',
    'checklist:view': 'all',
    'checklist:create': 'all',
    'checklist:edit': 'all',
    'checklist:delete': 'all',
    'dependency:view': 'all',
    'dependency:create': 'all',
    'dependency:edit': 'all',
    'dependency:delete': 'all',
    'comment:create': 'all',
    'comment:edit': 'own',
    'comment:delete': 'own',
    'credentials:view': 'all',
    'credentials:create': 'all',
    'credentials:edit': 'all',
    'credentials:delete': 'all',
  },
  [UserRole.MANAGER]: {
    'client:view': 'all',
    'client:create': 'all',
    'client:edit': 'all',
    'engagement:view': 'all',
    'engagement:create': 'all',
    'engagement:edit': 'all',
    'engagement:status_change': 'all',
    'task:view': 'all',
    'task:create': 'all',
    'task:edit': 'all',
    'task:assign': 'all',
    'task:status_change': 'all',
    'task:delete': 'all',
    'checklist:view': 'all',
    'checklist:create': 'all',
    'checklist:edit': 'all',
    'checklist:delete': 'all',
    'dependency:view': 'all',
    'dependency:create': 'all',
    'dependency:edit': 'all',
    'dependency:delete': 'all',
    'comment:create': 'all',
    'comment:edit': 'own',
    'comment:delete': 'own',
    'credentials:view': 'all',
    'credentials:create': 'all',
    'credentials:edit': 'all',
    'credentials:delete': 'all',
  },
  [UserRole.JUNIOR_CA]: {
    'client:view': 'assigned',
    'engagement:view': 'assigned',
    'task:view': 'assigned',
    'task:create': 'all',
    'task:edit': 'own',
    'task:status_change': 'own',
    'checklist:view': 'own',
    'checklist:create': 'own',
    'checklist:edit': 'own',
    'checklist:delete': 'own',
    'comment:create': 'all',
    'comment:edit': 'own',
    'comment:delete': 'own',
    'credentials:view': 'assigned',
    'credentials:create': 'assigned',
    'credentials:edit': 'assigned',
    'credentials:delete': 'assigned',
  },
  [UserRole.ARTICLE]: {
    'client:view': 'assigned',
    'engagement:view': 'assigned',
    'task:view': 'assigned',
    'task:create': 'all',
    'task:edit': 'own',
    'task:status_change': 'own',
    'checklist:view': 'own',
    'checklist:create': 'own',
    'checklist:edit': 'own',
    'checklist:delete': 'own',
    'comment:create': 'all',
    'comment:edit': 'own',
    'comment:delete': 'own',
  },
  [UserRole.ADMIN]: {
    'client:view': 'all',
    'client:create': 'all',
    'client:edit': 'all',
    'client:delete': 'all',
    'engagement:view': 'all',
    'engagement:create': 'all',
    'engagement:edit': 'all',
    'engagement:status_change': 'all',
    'task:view': 'all',
    'task:create': 'all',
    'task:edit': 'all',
    'task:assign': 'all',
    'task:status_change': 'all',
    'task:delete': 'all',
    'checklist:view': 'all',
    'checklist:create': 'all',
    'checklist:edit': 'all',
    'checklist:delete': 'all',
    'dependency:view': 'all',
    'dependency:create': 'all',
    'dependency:edit': 'all',
    'dependency:delete': 'all',
    'comment:create': 'all',
    'comment:edit': 'own',
    'comment:delete': 'all',
    'credentials:view': 'all',
    'credentials:create': 'all',
    'credentials:edit': 'all',
    'credentials:delete': 'all',
  },
};

export function getDefaultScope(
  role: UserRole,
  resource: Resource,
  action: Action,
): Scope | null {
  const key = `${resource}:${action}` as PermissionKey;
  return DEFAULT_ROLE_PERMISSIONS[role][key] ?? null;
}

export function flattenDefaultPermissions(): Array<{
  role: UserRole;
  resource: Resource;
  action: Action;
  scope: Scope;
}> {
  const out: Array<{
    role: UserRole;
    resource: Resource;
    action: Action;
    scope: Scope;
  }> = [];
  for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS) as UserRole[]) {
    const perms = DEFAULT_ROLE_PERMISSIONS[role];
    for (const key of Object.keys(perms) as PermissionKey[]) {
      const [resource, action] = key.split(':') as [Resource, Action];
      out.push({ role, resource, action, scope: perms[key]! });
    }
  }
  return out;
}
