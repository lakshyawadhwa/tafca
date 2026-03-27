import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  getRequestId,
  getFirmId,
  getUserId,
} from '../context/request-context';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration_ms = Date.now() - startTime;
      let requestId: string;
      let firmId: string;
      let userId: string;

      try {
        requestId = getRequestId();
        firmId = getFirmId();
        userId = getUserId();
      } catch {
        requestId =
          (req.headers['x-request-id'] as string) || 'unknown';
        firmId = '';
        userId = '';
      }

      const logData = {
        request_id: requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration_ms,
        firm_id: firmId || undefined,
        user_id: userId || undefined,
        ip: req.ip,
        user_agent: req.get('user-agent'),
      };

      if (res.statusCode >= 400) {
        this.logger.warn(JSON.stringify(logData));
      } else {
        this.logger.log(JSON.stringify(logData));
      }
    });

    next();
  }
}
