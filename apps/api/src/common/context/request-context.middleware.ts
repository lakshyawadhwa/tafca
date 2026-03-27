import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { requestContextStorage } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as any).user;
    const context = {
      firmId: user?.firmId || '',
      userId: user?.userId || user?.sub || '',
      requestId: (req.headers['x-request-id'] as string) || randomUUID(),
    };
    requestContextStorage.run(context, next);
  }
}
