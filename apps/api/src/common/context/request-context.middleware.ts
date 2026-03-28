import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { requestContextStorage } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as any).user;
    let firmId = user?.firmId || '';
    let userId = user?.userId || user?.sub || '';

    // If no user yet (pre-guard), try to extract from JWT for Prisma extension
    if (!firmId) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const token = authHeader.slice(7);
          const decoded = JSON.parse(
            Buffer.from(token.split('.')[1], 'base64url').toString(),
          );
          firmId = decoded.firmId || '';
          userId = decoded.sub || '';
        } catch {
          /* ignore -- guard will handle validation */
        }
      }
    }

    const context = {
      firmId,
      userId,
      requestId: (req.headers['x-request-id'] as string) || randomUUID(),
    };
    requestContextStorage.run(context, next);
  }
}
