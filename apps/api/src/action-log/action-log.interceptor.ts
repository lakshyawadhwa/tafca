import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { ActionLogService } from './action-log.service';

@Injectable()
export class ActionLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActionLogInterceptor.name);

  constructor(private readonly actionLogService: ActionLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only log mutating methods
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((responseBody) => {
        try {
          const user = request.user; // JwtPayload from guard
          if (!user) return; // Public routes (register, login) -- skip

          const { action, entityType, entityId } = this.deriveAction(
            request,
            responseBody,
          );

          const ipAddress =
            (request.headers['x-forwarded-for'] as string)
              ?.split(',')[0]
              ?.trim() || request.ip;
          const userAgent = request.headers['user-agent'];

          // Sanitize metadata: strip sensitive fields from request body
          const metadata = this.sanitizeBody(request.body);

          // Fire and forget -- DO NOT await
          this.actionLogService.log({
            firmId: user.firmId,
            userId: user.sub,
            action,
            entityType,
            entityId,
            metadata,
            ipAddress,
            userAgent,
          });
        } catch (err) {
          this.logger.error(
            'Failed to create action log entry',
            (err as Error).message,
          );
        }
      }),
    );
  }

  /**
   * Derive action, entity type, and entity ID from the request.
   * Pattern: "entity_type.operation" from route.
   *
   * POST /api/users -> { action: 'user.create', entityType: 'user', entityId: response.id }
   * PATCH /api/users/:id -> { action: 'user.update', entityType: 'user', entityId: params.id }
   * PATCH /api/users/:id/deactivate -> { action: 'user.deactivate', entityType: 'user', entityId: params.id }
   * DELETE /api/users/:id -> { action: 'user.delete', entityType: 'user', entityId: params.id }
   */
  private deriveAction(
    request: any,
    responseBody: any,
  ): { action: string; entityType: string; entityId?: string } {
    const path = request.route?.path || request.path || '';
    const method = request.method;

    // Remove /api/ prefix and split
    const cleanPath = path.replace(/^\/api\//, '');
    const segments = cleanPath.split('/').filter(Boolean);

    // First segment is entity type (e.g., 'users' -> 'user', 'clients' -> 'client')
    const entityTypePlural = segments[0] || 'unknown';
    const entityType = entityTypePlural.replace(/s$/, ''); // naive singularize

    // Determine operation
    let operation: string;
    if (method === 'POST') {
      operation = 'create';
    } else if (method === 'DELETE') {
      operation = 'delete';
    } else if (method === 'PATCH' || method === 'PUT') {
      // Check for sub-action (e.g., /users/:id/deactivate)
      const lastSegment = segments[segments.length - 1];
      if (
        lastSegment &&
        !lastSegment.startsWith(':') &&
        lastSegment !== entityTypePlural
      ) {
        operation = lastSegment; // 'deactivate', 'change-password', etc.
      } else {
        operation = 'update';
      }
    } else {
      operation = method.toLowerCase();
    }

    // Entity ID: from route params or response body
    const entityId =
      request.params?.id || responseBody?.id || undefined;

    return { action: `${entityType}.${operation}`, entityType, entityId };
  }

  /**
   * Strip sensitive fields from request body for metadata storage.
   */
  private sanitizeBody(body: any): Record<string, unknown> {
    if (!body || typeof body !== 'object') return {};
    const sanitized = { ...body };
    const sensitiveKeys = [
      'password',
      'passwordHash',
      'currentPassword',
      'newPassword',
      'token',
      'secret',
    ];
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  }
}
