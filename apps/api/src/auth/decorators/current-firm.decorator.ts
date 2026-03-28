import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Extracts the firmId from the JWT payload.
 *
 * Usage:
 *   @Get('clients')
 *   getClients(@CurrentFirm() firmId: string) { ... }
 */
export const CurrentFirm = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload = request.user;
    return user.firmId;
  },
);
