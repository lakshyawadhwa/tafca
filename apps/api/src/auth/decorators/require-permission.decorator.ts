import { SetMetadata } from '@nestjs/common';
import type { Action, Resource } from '@ca-practice-os/shared';

export const PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermission {
  resource: Resource;
  action: Action;
}

/**
 * Declares the permission a route needs, checked by PermissionGuard against
 * the role matrix in PermissionService.
 *
 * The guard answers "may this role do this at all?". Routes whose scope can be
 * 'assigned' or 'own' must ALSO check the specific record in the service, since
 * the guard cannot know the subject before it is loaded.
 */
export const RequirePermission = (resource: Resource, action: Action) =>
  SetMetadata(PERMISSION_KEY, { resource, action } as RequiredPermission);
