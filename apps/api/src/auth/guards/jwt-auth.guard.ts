import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthContext } from '../interfaces/auth-context.interface';

/**
 * Global guard applied to every route.
 * - Skips routes marked with @Public()
 * - Validates JWT + session existence (via JwtStrategy)
 * - Sets authContext on the request for the context middleware to use
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check for @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Delegate to Passport JwtStrategy
    return super.canActivate(context);
  }

  /**
   * Called after Passport successfully validates the JWT.
   * We use this hook to attach the auth context to the request.
   */
  handleRequest<T = JwtPayload>(
    err: Error | null,
    user: T | false,
    _info: unknown,
    context: ExecutionContext,
  ): T {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }

    const payload = user as unknown as JwtPayload;
    const request = context.switchToHttp().getRequest();

    // Set the auth context on request for decorators and context middleware
    const authContext: AuthContext = {
      userId: payload.sub,
      firmId: payload.firmId,
      role: payload.role,
      sessionId: payload.sessionId,
    };

    request.authContext = authContext;

    return user;
  }
}
