import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  TaskStatus,
  TaskAction,
  TASK_STATUS_TRANSITIONS,
} from '@ca-practice-os/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import { TaskActivityService } from './task-activity.service';
import { TaskNotificationHelper } from './task-notification.helper';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import {
  TaskResponseDto,
  TaskListItemDto,
  TaskListResponseDto,
} from './dto/task-response.dto';

/** Default number of days to subtract from dueDate for internal deadline. */
const DEFAULT_INTERNAL_BUFFER_DAYS = 3;

/** Fields to select for full task detail response. */
const TASK_DETAIL_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  engagementId: true,
  clientId: true,
  parentTaskId: true,
  assigneeId: true,
  reviewerId: true,
  dueDate: true,
  internalDueDate: true,
  tags: true,
  completedAt: true,
  cancelledAt: true,
  isRecurring: true,
  estimatedHours: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  client: {
    select: { id: true, displayName: true },
  },
  engagement: {
    select: { id: true, name: true },
  },
  assignee: {
    select: { id: true, fullName: true },
  },
  reviewer: {
    select: { id: true, fullName: true },
  },
  parentTask: {
    select: { id: true, title: true },
  },
  _count: {
    select: { subTasks: true },
  },
  checklists: {
    where: { deletedAt: null },
    select: { isCompleted: true, isRequired: true },
  },
  dependsOn: {
    select: {
      dependsOnTask: {
        select: { status: true },
      },
    },
  },
} as const;

/** Lighter select for list queries. */
const TASK_LIST_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  assigneeId: true,
  reviewerId: true,
  dueDate: true,
  tags: true,
  completedAt: true,
  cancelledAt: true,
  createdAt: true,
  client: {
    select: { id: true, displayName: true },
  },
  engagement: {
    select: { id: true, name: true },
  },
  assignee: {
    select: { id: true, fullName: true },
  },
  _count: {
    select: { subTasks: true },
  },
  checklists: {
    where: { deletedAt: null },
    select: { isCompleted: true },
  },
  dependsOn: {
    select: {
      dependsOnTask: {
        select: { status: true },
      },
    },
  },
} as const;

@Injectable()
export class TaskService extends FirmScopedService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    prismaService: PrismaService,
    private readonly activityService: TaskActivityService,
    private readonly notificationHelper: TaskNotificationHelper,
  ) {
    super(prismaService);
  }

  // ───────────────────────── Create ─────────────────────────

  async createTask(dto: CreateTaskDto): Promise<TaskResponseDto> {
    const firmId = this.getFirmId();
    const userId = this.getUserId();

    // Subtask depth enforcement (TASK-06)
    if (dto.parentTaskId) {
      const parent = await this.prisma.task.findUnique({
        where: { id: dto.parentTaskId },
        select: { id: true, parentTaskId: true },
      });
      if (!parent) {
        throw new NotFoundException('Parent task not found');
      }
      if (parent.parentTaskId !== null) {
        throw new BadRequestException(
          'Subtask depth limited to 1 level — cannot create a subtask of a subtask',
        );
      }
    }

    // Validate engagement exists and auto-set clientId
    let clientId = dto.clientId || null;
    if (dto.engagementId) {
      const engagement = await this.prisma.engagement.findUnique({
        where: { id: dto.engagementId },
        select: { id: true, clientId: true },
      });
      if (!engagement) {
        throw new NotFoundException('Engagement not found');
      }
      if (!clientId) {
        clientId = engagement.clientId;
      }
    }

    // Validate client exists (if provided without engagement)
    if (clientId && !dto.engagementId) {
      const client = await this.prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true },
      });
      if (!client) {
        throw new NotFoundException('Client not found');
      }
    }

    // Compute internal due date (TASK-05)
    let internalDueDate: Date | null = null;
    if (dto.dueDate) {
      if (dto.internalDueDate) {
        // User explicitly provided — validate it's <= dueDate
        internalDueDate = new Date(dto.internalDueDate);
        if (internalDueDate > new Date(dto.dueDate)) {
          throw new BadRequestException(
            'Internal due date must be on or before the due date',
          );
        }
      } else {
        // Auto-compute from firm buffer
        internalDueDate = await this.computeInternalDueDate(
          new Date(dto.dueDate),
        );
      }
    }

    // Build create data
    const createData: any = {
      firmId,
      title: dto.title,
      description: dto.description || null,
      engagementId: dto.engagementId || null,
      clientId,
      parentTaskId: dto.parentTaskId || null,
      assigneeId: dto.assigneeId || null,
      reviewerId: dto.reviewerId || null,
      priority: dto.priority || 'MEDIUM',
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      internalDueDate,
      tags: dto.tags || [],
      customFields: {},
      createdBy: userId,
      updatedBy: userId,
    };

    // Nested checklist creation
    if (dto.initialChecklistItems && dto.initialChecklistItems.length > 0) {
      createData.checklists = {
        create: dto.initialChecklistItems.map((item, i) => ({
          firmId,
          label: item.label,
          isRequired: item.isRequired ?? true,
          displayOrder: i,
          createdBy: userId,
          updatedBy: userId,
        })),
      };
    }

    const task = await this.prisma.task.create({
      data: createData,
      select: TASK_DETAIL_SELECT,
    });

    // Fire-and-forget activity log
    this.activityService
      .log(task.id, TaskAction.CREATED, null, {
        title: dto.title,
        status: 'TO_DO',
        priority: dto.priority || 'MEDIUM',
      })
      .catch(() => {});

    // Fire-and-forget assignee notification
    if (dto.assigneeId) {
      this.notificationHelper
        .onAssigneeChange(
          {
            id: task.id,
            title: dto.title,
            assigneeId: dto.assigneeId,
            reviewerId: dto.reviewerId || null,
            engagementId: dto.engagementId || null,
            clientId,
          },
          null,
          dto.assigneeId,
        )
        .catch(() => {});
    }

    this.logger.log(`Task created: ${task.id} (${dto.title})`);
    return this.toTaskResponse(task);
  }

  // ───────────────────────── Get ─────────────────────────

  async getTask(id: string): Promise<TaskResponseDto> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: TASK_DETAIL_SELECT,
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.toTaskResponse(task);
  }

  // ───────────────────────── List ─────────────────────────

  async listTasks(query: ListTasksQueryDto): Promise<TaskListResponseDto> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      assigneeId,
      clientId,
      engagementId,
      status,
      priority,
      dueDateFrom,
      dueDateTo,
      overdue,
      parentTaskId,
    } = query;

    const where: Record<string, any> = {};

    // Default: only top-level tasks unless parentTaskId explicitly provided
    if (parentTaskId) {
      where.parentTaskId = parentTaskId;
    } else {
      where.parentTaskId = null;
    }

    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    if (assigneeId) where.assigneeId = assigneeId;
    if (clientId) where.clientId = clientId;
    if (engagementId) where.engagementId = engagementId;

    // Comma-separated status filter
    if (status) {
      const statuses = status.split(',').map((s) => s.trim());
      where.status = { in: statuses };
    }

    // Comma-separated priority filter
    if (priority) {
      const priorities = priority.split(',').map((p) => p.trim());
      where.priority = { in: priorities };
    }

    // Date range filters
    if (dueDateFrom || dueDateTo) {
      where.dueDate = {};
      if (dueDateFrom) where.dueDate.gte = new Date(dueDateFrom);
      if (dueDateTo) where.dueDate.lte = new Date(dueDateTo);
    }

    // Overdue filter
    if (overdue) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.dueDate = { ...where.dueDate, lt: today };
      where.status = { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] };
    }

    const skip = (page - 1) * limit;
    const orderBy = { [sortBy]: sortOrder };

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: TASK_LIST_SELECT,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: data.map((task: any) => this.toTaskListItem(task)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ───────────────────────── Update ─────────────────────────

  async updateTask(
    id: string,
    dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    const existing = await this.prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        assigneeId: true,
        reviewerId: true,
        dueDate: true,
        priority: true,
        engagementId: true,
        clientId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    const userId = this.getUserId();
    const updateData: Record<string, any> = {
      updatedBy: userId,
    };

    // Build update fields
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.clientId !== undefined) updateData.clientId = dto.clientId;
    if (dto.assigneeId !== undefined) updateData.assigneeId = dto.assigneeId;
    if (dto.reviewerId !== undefined) updateData.reviewerId = dto.reviewerId;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.tags !== undefined) updateData.tags = dto.tags;

    // Due date logic (CONTEXT.md / RESEARCH Pitfall 6)
    if (dto.dueDate !== undefined) {
      if (dto.dueDate === null) {
        // Clearing dueDate also clears internalDueDate
        updateData.dueDate = null;
        updateData.internalDueDate = null;
      } else {
        updateData.dueDate = new Date(dto.dueDate);

        if (dto.internalDueDate !== undefined) {
          if (dto.internalDueDate === null) {
            updateData.internalDueDate = null;
          } else {
            const intDate = new Date(dto.internalDueDate);
            if (intDate > new Date(dto.dueDate)) {
              throw new BadRequestException(
                'Internal due date must be on or before the due date',
              );
            }
            updateData.internalDueDate = intDate;
          }
        } else {
          // Recompute internal due date from firm buffer
          updateData.internalDueDate = await this.computeInternalDueDate(
            new Date(dto.dueDate),
          );
        }
      }
    } else if (dto.internalDueDate !== undefined) {
      // Only internalDueDate is being updated
      if (dto.internalDueDate === null) {
        updateData.internalDueDate = null;
      } else {
        const intDate = new Date(dto.internalDueDate);
        if (existing.dueDate && intDate > existing.dueDate) {
          throw new BadRequestException(
            'Internal due date must be on or before the due date',
          );
        }
        updateData.internalDueDate = intDate;
      }
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: updateData,
      select: TASK_DETAIL_SELECT,
    });

    // Track field changes for activity log (fire-and-forget)
    if (
      dto.assigneeId !== undefined &&
      dto.assigneeId !== existing.assigneeId
    ) {
      this.activityService
        .log(id, TaskAction.ASSIGNEE_CHANGED, existing.assigneeId, dto.assigneeId)
        .catch(() => {});
      this.notificationHelper
        .onAssigneeChange(
          {
            id,
            title: updated.title,
            assigneeId: dto.assigneeId,
            reviewerId: updated.reviewerId,
            engagementId: updated.engagementId,
            clientId: updated.clientId,
          },
          existing.assigneeId,
          dto.assigneeId,
        )
        .catch(() => {});
    }

    if (
      dto.reviewerId !== undefined &&
      dto.reviewerId !== existing.reviewerId
    ) {
      this.activityService
        .log(id, TaskAction.REVIEWER_CHANGED, existing.reviewerId, dto.reviewerId)
        .catch(() => {});
    }

    if (dto.dueDate !== undefined) {
      const oldDate = existing.dueDate?.toISOString() || null;
      const newDate = dto.dueDate;
      if (oldDate !== newDate) {
        this.activityService
          .log(id, TaskAction.DUE_DATE_CHANGED, oldDate, newDate)
          .catch(() => {});
      }
    }

    if (
      dto.priority !== undefined &&
      dto.priority !== existing.priority
    ) {
      this.activityService
        .log(id, TaskAction.PRIORITY_CHANGED, existing.priority, dto.priority)
        .catch(() => {});
    }

    this.logger.log(`Task updated: ${id}`);
    return this.toTaskResponse(updated);
  }

  // ───────────────────────── Status Change ─────────────────────────

  async changeTaskStatus(
    id: string,
    dto: ChangeTaskStatusDto,
  ): Promise<TaskResponseDto> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        assigneeId: true,
        reviewerId: true,
        engagementId: true,
        clientId: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const currentStatus = task.status as TaskStatus;
    const targetStatus = dto.status;

    // Validate transition
    const allowedTransitions = TASK_STATUS_TRANSITIONS[currentStatus];
    if (!allowedTransitions || !allowedTransitions.includes(targetStatus)) {
      throw new BadRequestException({
        message: `Cannot transition from ${currentStatus} to ${targetStatus}`,
        allowed_transitions: allowedTransitions || [],
      });
    }

    const userId = this.getUserId();
    const updateData: Record<string, any> = {
      status: targetStatus,
      updatedBy: userId,
    };

    // DONE gate (TASK-03): check required checklist items
    if (targetStatus === TaskStatus.DONE) {
      const incompleteRequired = await this.prisma.taskChecklist.count({
        where: {
          taskId: id,
          isRequired: true,
          isCompleted: false,
          deletedAt: null,
        },
      });

      if (incompleteRequired > 0) {
        throw new ConflictException({
          message: `Cannot mark as done: ${incompleteRequired} required checklist item${incompleteRequired > 1 ? 's are' : ' is'} incomplete`,
          incomplete_required_items: incompleteRequired,
        });
      }

      updateData.completedAt = new Date();
    }

    // CANCELLED: set cancelledAt (TASK-04)
    if (targetStatus === TaskStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: updateData,
      select: TASK_DETAIL_SELECT,
    });

    // Fire-and-forget: activity log
    this.activityService
      .log(id, TaskAction.STATUS_CHANGED, currentStatus, targetStatus)
      .catch(() => {});

    // Fire-and-forget: notifications
    this.notificationHelper
      .onStatusChange(
        {
          id: task.id,
          title: task.title,
          assigneeId: task.assigneeId,
          reviewerId: task.reviewerId,
          engagementId: task.engagementId,
          clientId: task.clientId,
        },
        currentStatus,
        targetStatus,
      )
      .catch(() => {});

    // Check dependency unblocking when task is DONE
    if (targetStatus === TaskStatus.DONE) {
      this.checkDependencyUnblocking(id).catch(() => {});
    }

    this.logger.log(
      `Task status changed: ${id} (${currentStatus} -> ${targetStatus})`,
    );

    return this.toTaskResponse(updated);
  }

  // ───────────────────────── Delete ─────────────────────────

  async deleteTask(id: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.prisma.task.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: this.getUserId(),
      },
    });

    this.logger.log(`Task deleted: ${id}`);
  }

  // ───────────────────────── Private Helpers ─────────────────────────

  /**
   * Check if completing this task unblocks any dependent tasks.
   * For each dependent task where ALL dependencies are now DONE/CANCELLED,
   * emit TASK_DEPENDENCY_UNBLOCKED notification.
   */
  private async checkDependencyUnblocking(taskId: string): Promise<void> {
    try {
      // Find all tasks that depend on this completed task
      const dependents = await this.prisma.taskDependency.findMany({
        where: { dependsOnTaskId: taskId },
        select: {
          task: {
            select: {
              id: true,
              title: true,
              assigneeId: true,
              dependsOn: {
                select: {
                  dependsOnTask: {
                    select: { status: true },
                  },
                },
              },
            },
          },
        },
      });

      for (const dep of dependents) {
        const dependentTask = dep.task;
        // Check if ALL dependencies are resolved (DONE or CANCELLED)
        const allResolved = dependentTask.dependsOn.every(
          (d: any) =>
            d.dependsOnTask.status === TaskStatus.DONE ||
            d.dependsOnTask.status === TaskStatus.CANCELLED,
        );

        if (allResolved && dependentTask.assigneeId) {
          this.notificationHelper
            .onDependencyUnblocked(
              dependentTask.id,
              dependentTask.title,
              dependentTask.assigneeId,
            )
            .catch(() => {});
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to check dependency unblocking for task ${taskId}: ${error}`,
      );
    }
  }

  /**
   * Compute internal due date from firm buffer setting.
   */
  private async computeInternalDueDate(dueDate: Date): Promise<Date> {
    let bufferDays = DEFAULT_INTERNAL_BUFFER_DAYS;

    try {
      const firm = await this.unscopedPrisma.firm.findUnique({
        where: { id: this.getFirmId() },
        select: { settings: true },
      });

      if (firm?.settings) {
        const settings = firm.settings as Record<string, any>;
        if (typeof settings.default_internal_deadline_buffer_days === 'number') {
          bufferDays = settings.default_internal_deadline_buffer_days;
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to fetch firm settings for internal due date, using default buffer: ${error}`,
      );
    }

    const internalDate = new Date(dueDate.getTime());
    internalDate.setDate(internalDate.getDate() - bufferDays);
    return internalDate;
  }

  /**
   * Map a Prisma task record (detail select) to TaskResponseDto.
   */
  private toTaskResponse(task: any): TaskResponseDto {
    const checklists = task.checklists || [];
    const completedCount = checklists.filter(
      (c: any) => c.isCompleted,
    ).length;

    const dependsOn = task.dependsOn || [];
    const isBlocked = dependsOn.some(
      (d: any) =>
        d.dependsOnTask.status !== TaskStatus.DONE &&
        d.dependsOnTask.status !== TaskStatus.CANCELLED,
    );

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      engagementId: task.engagementId,
      clientId: task.clientId,
      parentTaskId: task.parentTaskId,
      assigneeId: task.assigneeId,
      reviewerId: task.reviewerId,
      dueDate: task.dueDate?.toISOString() || null,
      internalDueDate: task.internalDueDate?.toISOString() || null,
      tags: task.tags || [],
      completedAt: task.completedAt?.toISOString() || null,
      cancelledAt: task.cancelledAt?.toISOString() || null,
      isRecurring: task.isRecurring || false,
      estimatedHours: task.estimatedHours
        ? Number(task.estimatedHours)
        : null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      createdBy: task.createdBy,
      checklistProgress: {
        completed: completedCount,
        total: checklists.length,
      },
      isBlocked,
      subtaskCount: task._count?.subTasks || 0,
      client: task.client
        ? { id: task.client.id, displayName: task.client.displayName }
        : null,
      engagement: task.engagement
        ? { id: task.engagement.id, name: task.engagement.name }
        : null,
      assignee: task.assignee
        ? { id: task.assignee.id, fullName: task.assignee.fullName }
        : null,
      reviewer: task.reviewer
        ? { id: task.reviewer.id, fullName: task.reviewer.fullName }
        : null,
      parentTask: task.parentTask
        ? { id: task.parentTask.id, title: task.parentTask.title }
        : null,
    };
  }

  /**
   * Map a Prisma task record (list select) to TaskListItemDto.
   */
  private toTaskListItem(task: any): TaskListItemDto {
    const checklists = task.checklists || [];
    const completedCount = checklists.filter(
      (c: any) => c.isCompleted,
    ).length;

    const dependsOn = task.dependsOn || [];
    const isBlocked = dependsOn.some(
      (d: any) =>
        d.dependsOnTask.status !== TaskStatus.DONE &&
        d.dependsOnTask.status !== TaskStatus.CANCELLED,
    );

    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      reviewerId: task.reviewerId,
      dueDate: task.dueDate?.toISOString() || null,
      tags: task.tags || [],
      completedAt: task.completedAt?.toISOString() || null,
      cancelledAt: task.cancelledAt?.toISOString() || null,
      createdAt: task.createdAt.toISOString(),
      checklistProgress: {
        completed: completedCount,
        total: checklists.length,
      },
      isBlocked,
      subtaskCount: task._count?.subTasks || 0,
      client: task.client
        ? { id: task.client.id, displayName: task.client.displayName }
        : null,
      engagement: task.engagement
        ? { id: task.engagement.id, name: task.engagement.name }
        : null,
      assignee: task.assignee
        ? { id: task.assignee.id, fullName: task.assignee.fullName }
        : null,
    };
  }
}
