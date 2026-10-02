import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getRequestId } from '../context/request-context';

/**
 * Unhandled errors are only detailed outside production. Read once at module
 * load: NODE_ENV does not change while the process is alive.
 */
const exposeInternals = process.env.NODE_ENV !== 'production';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, any>;
        message = resp.message || exception.message;
        error = resp.error || exception.name;
      } else {
        message = exception.message;
        error = exception.name;
      }
    } else if (exception instanceof Error) {
      // A non-HttpException reaching here is an unhandled fault. Its message can
      // carry internals (Prisma echoes the failing query, constraint names and
      // local file paths), so outside production we surface it to make the bug
      // obvious, and in production we return the generic text and keep the
      // detail in the logs, reachable via request_id.
      if (exposeInternals) {
        message = exception.message;
        error = exception.name;
      }
    }

    let requestId: string;
    try {
      requestId = getRequestId();
    } catch {
      requestId =
        (request.headers['x-request-id'] as string) || 'unknown';
    }

    // Log 5xx errors at error level, 4xx at warn
    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${statusCode} - ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${statusCode} - ${JSON.stringify(message)}`,
      );
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
      request_id: requestId,
    });
  }
}
