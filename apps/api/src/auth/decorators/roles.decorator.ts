import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@ca-practice-os/shared';

export const ROLES_KEY = 'roles';

/**
 * Specifies which roles can access a route.
 *
 * Usage:
 *   @Roles(UserRole.PARTNER, UserRole.ADMIN)
 *   @Get('settings')
 *   getSettings() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
