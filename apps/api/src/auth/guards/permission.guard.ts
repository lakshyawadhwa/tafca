import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@ca-practice-os/shared';
import {
  PERMISSION_KEY,
  RequiredPermission,
} from '../decorators/require-permission.decorator';
import { PermissionService } from '../../permission/permission.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Enforces the role permission matrix for routes marked with
 * @RequirePermission(). Routes without the decorator are left alone, so this
 * can be rolled out per module without changing unrelated behaviour.
 *
 * Only the coarse question is answered here — does this role hold this
 * permission at all. When the resolved scope is 'assigned' or 'own', the
 * record itself still has to be checked in the service, which is the only
 * place that knows who owns it.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;

    if (!user) throw new ForbiddenException('No user context found');

    const scope = await this.permissionService.getScope(
      user.firmId,
      user.role as UserRole,
      required.resource,
      required.action,
    );

    if (!scope) {
      throw new ForbiddenException(
        `Role '${user.role}' cannot ${required.action} ${required.resource}`,
      );
    }

    // Services read this to narrow list queries and to authorise single records.
    request.permissionScope = scope;
    return true;
  }
}
