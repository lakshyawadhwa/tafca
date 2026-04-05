import { Injectable } from '@nestjs/common';
import { TaskStatus, TaskPriority, UserRole } from '@ca-practice-os/shared';
import type { WorkloadStatus } from '@ca-practice-os/shared';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  WorkloadUserDto,
  WorkloadResponseDto,
} from './dto/workload-response.dto';
import { ApprovalQueueQueryDto } from './dto/approval-queue-query.dto';
import {
  ApprovalQueueItemDto,
  PaginatedApprovalQueueResponseDto,
} from './dto/approval-queue-response.dto';

const TERMINAL_STATUSES: TaskStatus[] = [TaskStatus.DONE, TaskStatus.CANCELLED];

@Injectable()
export class TeamService extends FirmScopedService {
  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  /**
   * Compute workload for all active users in the firm.
   * Uses groupBy queries for efficient aggregation.
   */
  async getWorkload(): Promise<WorkloadResponseDto> {
    const firmId = this.getFirmId();

    // Fetch active users
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, role: true, avatarUrl: true },
    });

    if (users.length === 0) {
      return { data: [], firmAverage: 0 };
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const baseWhere = {
      firmId,
      status: { notIn: TERMINAL_STATUSES },
      deletedAt: null,
    };

    // Run 3 parallel groupBy queries
    const [openGroups, overdueGroups, dueThisWeekGroups] = await Promise.all([
      this.unscopedPrisma.task.groupBy({
        by: ['assigneeId'],
        where: baseWhere,
        _count: { id: true },
      }),
      this.unscopedPrisma.task.groupBy({
        by: ['assigneeId'],
        where: {
          ...baseWhere,
          dueDate: { lt: startOfToday },
        },
        _count: { id: true },
      }),
      this.unscopedPrisma.task.groupBy({
        by: ['assigneeId'],
        where: {
          ...baseWhere,
          dueDate: { gte: startOfToday, lte: endOfWeek },
        },
        _count: { id: true },
      }),
    ]);

    // Build maps for quick lookup
    const openMap = new Map(
      openGroups
        .filter((g) => g.assigneeId !== null)
        .map((g) => [g.assigneeId!, g._count.id]),
    );
    const overdueMap = new Map(
      overdueGroups
        .filter((g) => g.assigneeId !== null)
        .map((g) => [g.assigneeId!, g._count.id]),
    );
    const dueThisWeekMap = new Map(
      dueThisWeekGroups
        .filter((g) => g.assigneeId !== null)
        .map((g) => [g.assigneeId!, g._count.id]),
    );

    // Compute firm average
    const totalOpen = Array.from(openMap.values()).reduce((sum, c) => sum + c, 0);
    const firmAverage = users.length > 0 ? totalOpen / users.length : 0;

    // Build response with load status per user
    const data: WorkloadUserDto[] = users.map((user) => {
      const openTaskCount = openMap.get(user.id) ?? 0;
      const overdueTaskCount = overdueMap.get(user.id) ?? 0;
      const dueThisWeekCount = dueThisWeekMap.get(user.id) ?? 0;

      let loadStatus: WorkloadStatus;
      if (firmAverage === 0) {
        loadStatus = 'BALANCED';
      } else if (openTaskCount < firmAverage * 0.5) {
        loadStatus = 'UNDERUTILISED';
      } else if (openTaskCount > firmAverage * 1.5) {
        loadStatus = 'OVERLOADED';
      } else {
        loadStatus = 'BALANCED';
      }

      return {
        userId: user.id,
        fullName: user.fullName,
        role: user.role as UserRole,
        avatarUrl: user.avatarUrl,
        openTaskCount,
        overdueTaskCount,
        dueThisWeekCount,
        loadStatus,
      };
    });

    return { data, firmAverage: Math.round(firmAverage * 100) / 100 };
  }

  /**
   * Get tasks pending approval for the current user.
   * Only meaningful for PARTNER/MANAGER roles.
   */
  async getApprovalQueue(
    userId: string,
    userRole: UserRole,
    query: ApprovalQueueQueryDto,
  ): Promise<PaginatedApprovalQueueResponseDto> {
    const { page = 1, limit = 20 } = query;

    // Only PARTNER/MANAGER see approval queue items
    if (
      userRole !== UserRole.PARTNER &&
      userRole !== UserRole.MANAGER &&
      userRole !== UserRole.ADMIN
    ) {
      return {
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const skip = (page - 1) * limit;

    const where = {
      status: TaskStatus.PARTNER_APPROVAL,
      OR: [
        { reviewerId: userId },
        { engagement: { assignedPartnerId: userId } },
      ],
    };

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        select: {
          id: true,
          title: true,
          assigneeId: true,
          dueDate: true,
          priority: true,
          client: { select: { displayName: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    // Batch-fetch assignee names
    const assigneeIds = [
      ...new Set(tasks.map((t) => t.assigneeId).filter(Boolean) as string[]),
    ];
    const assignees =
      assigneeIds.length > 0
        ? await this.unscopedPrisma.user.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true, fullName: true },
          })
        : [];
    const assigneeMap = new Map(assignees.map((u) => [u.id, u.fullName]));

    const data: ApprovalQueueItemDto[] = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      clientName: task.client?.displayName ?? null,
      dueDate: task.dueDate?.toISOString().split('T')[0] ?? null,
      priority: task.priority as TaskPriority,
      assigneeName: task.assigneeId
        ? (assigneeMap.get(task.assigneeId) ?? null)
        : null,
    }));

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
