import {
  Injectable,
  CanActivate,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Ensures that the firmId is present in the JWT payload.
 * This is a sanity check -- if a request somehow gets past JwtAuthGuard
 * without a firmId, something is very wrong.
 *
 * Applied globally alongside JwtAuthGuard.
 */
@Injectable()
export class FirmScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!user?.firmId) {
      throw new InternalServerErrorException(
        'Firm context not established. This is a server error.',
      );
    }

    return true;
  }
}
