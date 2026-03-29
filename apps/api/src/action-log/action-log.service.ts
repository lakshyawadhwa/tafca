import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListActionLogQueryDto } from './dto/list-action-log-query.dto';
import {
  ActionLogEntryDto,
  PaginatedActionLogResponseDto,
} from './dto/action-log-response.dto';

@Injectable()
export class ActionLogService {
  private readonly logger = new Logger(ActionLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an immutable action log entry.
   * This is designed to be called fire-and-forget from the interceptor.
   * Errors are caught and logged -- they NEVER propagate to the API response (AUDIT-03).
   */
  log(params: {
    firmId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): void {
    this.prisma.unscoped.userActionLog
      .create({
        data: {
          firmId: params.firmId,
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId || null,
          metadata: (params.metadata as any) || {},
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      })
      .catch((err: Error) => {
        this.logger.error(
          `Failed to write action log: ${err.message}`,
          err.stack,
        );
      });
  }

  /**
   * Query action logs for a firm with optional filters.
   * Used by the audit-log endpoint (PARTNER/ADMIN only).
   */
  async listActionLogs(
    firmId: string,
    query: ListActionLogQueryDto,
  ): Promise<PaginatedActionLogResponseDto> {
    const { userId, entityType, entityId, action, from, to, page = 1, limit = 50 } = query;

    const where: Record<string, any> = { firmId };

    if (userId) {
      where.userId = userId;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (action) {
      where.action = { contains: action };
    }

    if (from || to) {
      where.occurredAt = {};
      if (from) {
        where.occurredAt.gte = new Date(from);
      }
      if (to) {
        where.occurredAt.lte = new Date(to);
      }
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.unscoped.userActionLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.unscoped.userActionLog.count({ where }),
    ]);

    // Batch-fetch user details for the log entries
    const userIds = [...new Set(logs.map((l) => l.userId))];
    const users = await this.prisma.unscoped.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data: ActionLogEntryDto[] = logs.map((log) => {
      const logUser = userMap.get(log.userId);
      return {
        id: log.id,
        user: {
          id: log.userId,
          fullName: logUser?.fullName || 'Unknown User',
        },
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata as Record<string, unknown>,
        ipAddress: log.ipAddress,
        occurredAt: log.occurredAt.toISOString(),
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
