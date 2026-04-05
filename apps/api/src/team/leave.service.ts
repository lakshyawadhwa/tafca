import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  LeaveStatus,
  UserRole,
  TaskStatus,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
} from '@ca-practice-os/shared';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { ListLeaveQueryDto } from './dto/list-leave-query.dto';
import { LeaveDto, PaginatedLeaveResponseDto } from './dto/leave-response.dto';

const TERMINAL_STATUSES: TaskStatus[] = [TaskStatus.DONE, TaskStatus.CANCELLED];

@Injectable()
export class LeaveService extends FirmScopedService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  /**
   * Create a leave request with overlap and date validation.
   */
  async createLeave(dto: CreateLeaveDto): Promise<LeaveDto> {
    const userId = this.getUserId();
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    // Validate endDate >= startDate
    if (endDate < startDate) {
      throw new BadRequestException('End date must be on or after start date');
    }

    // Validate isHalfDay only when single day
    if (dto.isHalfDay && dto.startDate !== dto.endDate) {
      throw new BadRequestException(
        'Half-day leave is only available for single-day requests',
      );
    }

    // Validate not in the past (startDate >= today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      throw new BadRequestException('Cannot create leave for past dates');
    }

    // Check for overlapping leaves (PENDING or APPROVED)
    const overlapping = await this.prisma.leaveRecord.findFirst({
      where: {
        userId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        'Leave request overlaps with an existing leave',
      );
    }

    const record = await this.prisma.leaveRecord.create({
      data: {
        firmId: this.getFirmId(),
        userId,
        leaveType: dto.leaveType,
        startDate,
        endDate,
        isHalfDay: dto.isHalfDay ?? false,
        reason: dto.reason ?? null,
        status: LeaveStatus.PENDING,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    return this.toDto(record, new Map());
  }

  /**
   * List leave requests with role-based visibility.
   * PARTNER/MANAGER see all firm leave. Others see only their own.
   */
  async listLeave(
    query: ListLeaveQueryDto,
    userRole: UserRole,
  ): Promise<PaginatedLeaveResponseDto> {
    const { status, userId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};

    // Role-based visibility
    if (
      userRole !== UserRole.PARTNER &&
      userRole !== UserRole.MANAGER &&
      userRole !== UserRole.ADMIN
    ) {
      where.userId = this.getUserId();
    }

    // Optional filters
    if (status) {
      where.status = status;
    }
    if (userId) {
      where.userId = userId;
    }

    const [records, total] = await Promise.all([
      this.prisma.leaveRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.leaveRecord.count({ where }),
    ]);

    // Batch-fetch user names for userId and approvedBy
    const allUserIds = [
      ...new Set([
        ...records.map((r) => r.userId),
        ...records.map((r) => r.approvedBy).filter(Boolean) as string[],
      ]),
    ];
    const users =
      allUserIds.length > 0
        ? await this.unscopedPrisma.user.findMany({
            where: { id: { in: allUserIds } },
            select: { id: true, fullName: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u.fullName]));

    return {
      data: records.map((r) => this.toDto(r, userMap)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Approve a pending leave request. PARTNER/MANAGER only.
   * Fire-and-forget: emits ASSIGNEE_ON_LEAVE for affected tasks.
   */
  async approveLeave(leaveId: string): Promise<LeaveDto> {
    const approverId = this.getUserId();

    const record = await this.prisma.leaveRecord.findUnique({
      where: { id: leaveId },
    });

    if (!record) {
      throw new NotFoundException('Leave request not found');
    }

    if (record.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Only pending leave requests can be approved',
      );
    }

    const updated = await this.prisma.leaveRecord.update({
      where: { id: leaveId },
      data: {
        status: LeaveStatus.APPROVED,
        approvedBy: approverId,
        approvedAt: new Date(),
        updatedBy: approverId,
      },
    });

    // Fire-and-forget: notify about tasks affected by leave
    this.emitLeaveNotifications(updated.userId, updated.startDate, updated.endDate)
      .catch((err) =>
        this.logger.error(`Failed to emit leave notifications: ${err}`),
      );

    return this.toDto(updated, new Map());
  }

  /**
   * Reject a pending leave request. PARTNER/MANAGER only.
   */
  async rejectLeave(
    leaveId: string,
    reason?: string,
  ): Promise<LeaveDto> {
    const approverId = this.getUserId();

    const record = await this.prisma.leaveRecord.findUnique({
      where: { id: leaveId },
    });

    if (!record) {
      throw new NotFoundException('Leave request not found');
    }

    if (record.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Only pending leave requests can be rejected',
      );
    }

    const updated = await this.prisma.leaveRecord.update({
      where: { id: leaveId },
      data: {
        status: LeaveStatus.REJECTED,
        approvedBy: approverId,
        approvedAt: new Date(),
        updatedBy: approverId,
      },
    });

    return this.toDto(updated, new Map());
  }

  /**
   * Cancel own leave. Must be PENDING or APPROVED with future start date.
   */
  async cancelLeave(leaveId: string): Promise<LeaveDto> {
    const userId = this.getUserId();

    const record = await this.prisma.leaveRecord.findFirst({
      where: { id: leaveId, userId },
    });

    if (!record) {
      throw new NotFoundException('Leave request not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (record.status === LeaveStatus.PENDING) {
      // Can always cancel pending
    } else if (record.status === LeaveStatus.APPROVED) {
      // Can only cancel approved if start date is in the future
      if (record.startDate < today) {
        throw new BadRequestException(
          'Cannot cancel approved leave that has already started',
        );
      }
    } else {
      throw new BadRequestException(
        'Only pending or future approved leave can be cancelled',
      );
    }

    const updated = await this.prisma.leaveRecord.update({
      where: { id: leaveId },
      data: {
        status: LeaveStatus.CANCELLED,
        updatedBy: userId,
      },
    });

    return this.toDto(updated, new Map());
  }

  // ───────────────────────── Private Helpers ─────────────────────────

  /**
   * Emit ASSIGNEE_ON_LEAVE notifications for tasks assigned to the user
   * with dueDate within the leave range.
   */
  private async emitLeaveNotifications(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const firmId = this.getFirmId();

    const tasks = await this.unscopedPrisma.task.findMany({
      where: {
        firmId,
        assigneeId: userId,
        status: { notIn: TERMINAL_STATUSES },
        deletedAt: null,
        dueDate: { gte: startDate, lte: endDate },
      },
      select: { id: true, title: true, reviewerId: true },
    });

    // Notify the reviewer (or skip if no reviewer)
    for (const task of tasks) {
      if (!task.reviewerId) continue;

      await this.unscopedPrisma.notification.create({
        data: {
          firmId,
          recipientId: task.reviewerId,
          type: NotificationType.ASSIGNEE_ON_LEAVE,
          title: 'Assignee on leave',
          body: `The assignee for '${task.title}' will be on leave during the task's due period`,
          entityType: 'Task',
          entityId: task.id,
          channel: NotificationChannel.IN_APP,
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        },
      });
    }
  }

  private toDto(record: any, userMap: Map<string, string>): LeaveDto {
    return {
      id: record.id,
      userId: record.userId,
      userName: userMap.get(record.userId) ?? 'Unknown User',
      leaveType: record.leaveType,
      startDate: record.startDate instanceof Date
        ? record.startDate.toISOString().split('T')[0]
        : String(record.startDate),
      endDate: record.endDate instanceof Date
        ? record.endDate.toISOString().split('T')[0]
        : String(record.endDate),
      isHalfDay: record.isHalfDay,
      reason: record.reason,
      status: record.status,
      approvedBy: record.approvedBy,
      approvedByName: record.approvedBy
        ? (userMap.get(record.approvedBy) ?? null)
        : null,
      approvedAt: record.approvedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
