import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  EngagementStatus,
  TaskStatus,
  TaskPriority,
  UserRole,
  ENGAGEMENT_STATUS_TRANSITIONS,
} from '@ca-practice-os/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import { EngagementTypeService } from '../engagement-type/engagement-type.service';
import { CreateEngagementDto } from './dto/create-engagement.dto';
import { UpdateEngagementDto } from './dto/update-engagement.dto';
import { ListEngagementsQueryDto } from './dto/list-engagements-query.dto';
import { ChangeEngagementStatusDto } from './dto/change-engagement-status.dto';
import {
  EngagementResponseDto,
  PaginatedEngagementsResponseDto,
} from './dto/engagement-response.dto';

const ENGAGEMENT_SELECT = {
  id: true,
  name: true,
  status: true,
  periodLabel: true,
  periodStart: true,
  periodEnd: true,
  assignedPartnerId: true,
  assignedManagerId: true,
  assignedTeam: true,
  feeAmount: true,
  feeCurrency: true,
  notes: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      displayName: true,
    },
  },
  engagementType: {
    select: {
      id: true,
      name: true,
      code: true,
      category: true,
      recurrence: true,
    },
  },
} as const;

@Injectable()
export class EngagementService extends FirmScopedService {
  private readonly logger = new Logger(EngagementService.name);

  constructor(
    prismaService: PrismaService,
    private readonly engagementTypeService: EngagementTypeService,
  ) {
    super(prismaService);
  }

  /**
   * Create a new engagement linked to a client and engagement type.
   * Auto-generates name, inherits partner/manager from client, and optionally
   * instantiates a task chain from the engagement type's template.
   */
  async createEngagement(
    dto: CreateEngagementDto,
  ): Promise<EngagementResponseDto> {
    // 1. Verify client exists in firm
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
      select: {
        id: true,
        displayName: true,
        assignedPartnerId: true,
        assignedManagerId: true,
        assignedJuniorId: true,
        assignedArticleId: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // 2. Verify engagement type exists (use unscopedPrisma for platform types with firmId: null)
    const engagementType =
      await this.unscopedPrisma.engagementType.findFirst({
        where: {
          id: dto.engagementTypeId,
          OR: [{ firmId: null }, { firmId: this.getFirmId() }],
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          defaultTaskTemplateId: true,
        },
      });

    if (!engagementType) {
      throw new NotFoundException('Engagement type not found');
    }

    // 3. Auto-generate name (ENG-02)
    let name = dto.name;
    if (!name) {
      const parts = [engagementType.name, client.displayName];
      if (dto.periodLabel) {
        parts.push(dto.periodLabel);
      }
      name = parts.join(' - ').substring(0, 200);
    }

    // 4. Inherit partner/manager from client (ENG-03)
    const assignedPartnerId =
      dto.assignedPartnerId ?? client.assignedPartnerId;
    const assignedManagerId =
      dto.assignedManagerId ?? client.assignedManagerId;

    const userId = this.getUserId();
    const firmId = this.getFirmId();

    // 5. Create the engagement record
    const engagement = await this.prisma.engagement.create({
      data: {
        firmId,
        clientId: dto.clientId,
        engagementTypeId: dto.engagementTypeId,
        name,
        status: EngagementStatus.ACTIVE,
        periodLabel: dto.periodLabel || null,
        periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
        periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
        assignedPartnerId: assignedPartnerId || null,
        assignedManagerId: assignedManagerId || null,
        assignedTeam: [],
        feeAmount: dto.feeAmount ?? null,
        feeCurrency: 'INR',
        notes: dto.notes || null,
        customFields: {},
        createdBy: userId,
        updatedBy: userId,
      },
      select: ENGAGEMENT_SELECT,
    });

    // 6. Template instantiation (ENG-04)
    let tasksCreated = 0;
    if (dto.autoCreateTasks && engagementType.defaultTaskTemplateId) {
      tasksCreated = await this.instantiateTasksFromTemplate(
        {
          id: engagement.id,
          clientId: dto.clientId,
          periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
        },
        client,
        engagementType.defaultTaskTemplateId,
      );
    }

    // Get task progress for response
    const taskProgress = await this.getTaskProgress(engagement.id);

    this.logger.log(
      `Engagement created: ${engagement.id} (${name})${tasksCreated > 0 ? ` with ${tasksCreated} tasks` : ''}`,
    );

    return {
      ...this.toEngagementResponse(engagement, taskProgress),
      tasksCreated,
    };
  }

  /**
   * Two-pass template instantiation algorithm.
   * Pass 1: Create all Task records, building a Map<displayOrder, taskId>.
   * Pass 2: Create TaskDependency records using the map to resolve order -> taskId.
   * Both passes wrapped in a single transaction for atomicity.
   */
  private async instantiateTasksFromTemplate(
    engagement: {
      id: string;
      clientId: string;
      periodEnd: Date | null;
    },
    client: {
      assignedPartnerId: string | null;
      assignedManagerId: string | null;
      assignedJuniorId: string | null;
      assignedArticleId: string | null;
    },
    templateId: string,
  ): Promise<number> {
    // Fetch template with items
    const template = await this.unscopedPrisma.taskTemplate.findFirst({
      where: { id: templateId, isActive: true },
      select: {
        items: {
          orderBy: { displayOrder: 'asc' },
          select: {
            title: true,
            description: true,
            assigneeRole: true,
            reviewerRole: true,
            dueOffsetDays: true,
            displayOrder: true,
            dependsOnOrder: true,
            isRequired: true,
          },
        },
      },
    });

    if (!template || template.items.length === 0) {
      return 0;
    }

    // Build role -> userId map from client team
    const roleMap: Record<string, string | null> = {
      [UserRole.PARTNER]: client.assignedPartnerId,
      [UserRole.MANAGER]: client.assignedManagerId,
      [UserRole.JUNIOR_CA]: client.assignedJuniorId,
      [UserRole.ARTICLE]: client.assignedArticleId,
    };

    const firmId = this.getFirmId();
    const userId = this.getUserId();

    // Execute both passes in a single transaction
    const taskCount = await this.unscopedPrisma.$transaction(async (tx) => {
      // Pass 1: Create all tasks, build displayOrder -> taskId map
      const orderToTaskId = new Map<number, string>();

      for (const item of template.items) {
        // Calculate due date from engagement period end + offset
        let dueDate: Date | null = null;
        if (engagement.periodEnd && item.dueOffsetDays !== null) {
          dueDate = new Date(engagement.periodEnd.getTime());
          dueDate.setDate(dueDate.getDate() + item.dueOffsetDays);
        }

        // Resolve assignee/reviewer from role map
        const assigneeId = item.assigneeRole
          ? roleMap[item.assigneeRole] || null
          : null;
        const reviewerId = item.reviewerRole
          ? roleMap[item.reviewerRole] || null
          : null;

        const task = await tx.task.create({
          data: {
            firmId,
            engagementId: engagement.id,
            clientId: engagement.clientId,
            title: item.title,
            description: item.description || null,
            assigneeId,
            reviewerId,
            dueDate,
            status: TaskStatus.TO_DO,
            priority: TaskPriority.MEDIUM,
            customFields: {},
            createdBy: userId,
            updatedBy: userId,
          },
          select: { id: true },
        });

        orderToTaskId.set(item.displayOrder, task.id);
      }

      // Pass 2: Create task dependencies based on dependsOnOrder
      for (const item of template.items) {
        const dependsOnOrders = item.dependsOnOrder as number[];
        if (!dependsOnOrders || dependsOnOrders.length === 0) continue;

        const taskId = orderToTaskId.get(item.displayOrder);
        if (!taskId) continue;

        for (const depOrder of dependsOnOrders) {
          const dependsOnTaskId = orderToTaskId.get(depOrder);
          if (!dependsOnTaskId) continue;

          await tx.taskDependency.create({
            data: {
              firmId,
              taskId,
              dependsOnTaskId,
            },
          });
        }
      }

      return template.items.length;
    });

    return taskCount;
  }

  /**
   * List engagements with pagination, search, and filters.
   * Includes client name, type name, and task progress.
   */
  async listEngagements(
    query: ListEngagementsQueryDto,
  ): Promise<PaginatedEngagementsResponseDto> {
    const {
      page = 1,
      limit = 20,
      search,
      clientId,
      engagementTypeId,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, any> = {};

    if (clientId) where.clientId = clientId;
    if (engagementTypeId) where.engagementTypeId = engagementTypeId;
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        {
          client: {
            displayName: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const skip = (page - 1) * limit;
    const orderBy = { [sortBy]: sortOrder };

    const [data, total] = await Promise.all([
      this.prisma.engagement.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          ...ENGAGEMENT_SELECT,
          _count: {
            select: { tasks: true },
          },
        },
      }),
      this.prisma.engagement.count({ where }),
    ]);

    // Get task progress for each engagement
    const engagementIds = data.map((e: any) => e.id);
    const doneCounts = await this.getTaskDoneCounts(engagementIds);

    return {
      data: data.map((e: any) => {
        const taskProgress = {
          total: e._count?.tasks || 0,
          done: doneCounts.get(e.id) || 0,
        };
        return this.toEngagementResponse(e, taskProgress);
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single engagement by ID with client, type, and task counts.
   */
  async getEngagement(id: string): Promise<EngagementResponseDto> {
    const engagement = await this.prisma.engagement.findUnique({
      where: { id },
      select: ENGAGEMENT_SELECT,
    });

    if (!engagement) {
      throw new NotFoundException('Engagement not found');
    }

    const taskProgress = await this.getTaskProgress(id);
    return this.toEngagementResponse(engagement, taskProgress);
  }

  /**
   * Update an engagement. Does not allow changing clientId or engagementTypeId.
   */
  async updateEngagement(
    id: string,
    dto: UpdateEngagementDto,
  ): Promise<EngagementResponseDto> {
    const existing = await this.prisma.engagement.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Engagement not found');
    }

    const data: Record<string, any> = {
      updatedBy: this.getUserId(),
    };

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.periodLabel !== undefined) data.periodLabel = dto.periodLabel;
    if (dto.periodStart !== undefined)
      data.periodStart = dto.periodStart ? new Date(dto.periodStart) : null;
    if (dto.periodEnd !== undefined)
      data.periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : null;
    if (dto.assignedPartnerId !== undefined)
      data.assignedPartnerId = dto.assignedPartnerId;
    if (dto.assignedManagerId !== undefined)
      data.assignedManagerId = dto.assignedManagerId;
    if (dto.feeAmount !== undefined) data.feeAmount = dto.feeAmount;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.prisma.engagement.update({
      where: { id },
      data,
      select: ENGAGEMENT_SELECT,
    });

    const taskProgress = await this.getTaskProgress(id);

    this.logger.log(`Engagement updated: ${id}`);
    return this.toEngagementResponse(updated, taskProgress);
  }

  /**
   * Change engagement status with transition validation.
   * - Validates against ENGAGEMENT_STATUS_TRANSITIONS map
   * - COMPLETED blocked if open tasks exist (ENG-07)
   * - CANCELLED cascades to child tasks (ENG-08)
   */
  async changeEngagementStatus(
    id: string,
    dto: ChangeEngagementStatusDto,
  ): Promise<EngagementResponseDto> {
    const engagement = await this.prisma.engagement.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!engagement) {
      throw new NotFoundException('Engagement not found');
    }

    const currentStatus = engagement.status as EngagementStatus;
    const targetStatus = dto.status;

    // Validate transition
    const allowedTransitions = ENGAGEMENT_STATUS_TRANSITIONS[currentStatus];
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

    // ENG-07: COMPLETED blocked if open tasks exist
    if (targetStatus === EngagementStatus.COMPLETED) {
      const openTaskCount = await this.prisma.task.count({
        where: {
          engagementId: id,
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
        },
      });

      if (openTaskCount > 0) {
        throw new ConflictException(
          `Cannot complete this engagement. ${openTaskCount} open task${openTaskCount > 1 ? 's' : ''} must be completed or cancelled first.`,
        );
      }

      updateData.completedAt = new Date();
    }

    // ENG-08: CANCELLED cascades to child tasks
    if (targetStatus === EngagementStatus.CANCELLED) {
      const cancelResult = await this.prisma.task.updateMany({
        where: {
          engagementId: id,
          status: { in: [TaskStatus.TO_DO, TaskStatus.IN_PROGRESS] },
        },
        data: {
          status: TaskStatus.CANCELLED,
          cancelledAt: new Date(),
          updatedBy: userId,
        },
      });

      this.logger.log(
        `Cancelled ${cancelResult.count} child tasks for engagement ${id}`,
      );
    }

    const updated = await this.prisma.engagement.update({
      where: { id },
      data: updateData,
      select: ENGAGEMENT_SELECT,
    });

    const taskProgress = await this.getTaskProgress(id);

    this.logger.log(
      `Engagement status changed: ${id} (${currentStatus} -> ${targetStatus})`,
    );

    return this.toEngagementResponse(updated, taskProgress);
  }

  // ───────────────────────── Private Helpers ─────────────────────────

  /**
   * Get task progress (total / done) for a single engagement.
   */
  private async getTaskProgress(
    engagementId: string,
  ): Promise<{ total: number; done: number }> {
    const [total, done] = await Promise.all([
      this.prisma.task.count({ where: { engagementId } }),
      this.prisma.task.count({
        where: {
          engagementId,
          status: { in: [TaskStatus.DONE, TaskStatus.CANCELLED] },
        },
      }),
    ]);

    return { total, done };
  }

  /**
   * Get done task counts for multiple engagements (batch query for list view).
   */
  private async getTaskDoneCounts(
    engagementIds: string[],
  ): Promise<Map<string, number>> {
    if (engagementIds.length === 0) return new Map();

    const results = await this.prisma.task.groupBy({
      by: ['engagementId'],
      where: {
        engagementId: { in: engagementIds },
        status: { in: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      },
      _count: { id: true },
    });

    const map = new Map<string, number>();
    for (const r of results) {
      if (r.engagementId) {
        map.set(r.engagementId, r._count.id);
      }
    }
    return map;
  }

  /**
   * Map a Prisma engagement record to the response DTO.
   */
  private toEngagementResponse(
    engagement: any,
    taskProgress: { total: number; done: number },
  ): EngagementResponseDto {
    return {
      id: engagement.id,
      name: engagement.name,
      status: engagement.status,
      periodLabel: engagement.periodLabel,
      periodStart: engagement.periodStart?.toISOString() || null,
      periodEnd: engagement.periodEnd?.toISOString() || null,
      assignedPartnerId: engagement.assignedPartnerId,
      assignedManagerId: engagement.assignedManagerId,
      assignedTeam: engagement.assignedTeam || [],
      feeAmount: engagement.feeAmount
        ? Number(engagement.feeAmount)
        : null,
      feeCurrency: engagement.feeCurrency || 'INR',
      notes: engagement.notes,
      completedAt: engagement.completedAt?.toISOString() || null,
      createdAt: engagement.createdAt.toISOString(),
      updatedAt: engagement.updatedAt.toISOString(),
      client: {
        id: engagement.client.id,
        displayName: engagement.client.displayName,
      },
      engagementType: {
        id: engagement.engagementType.id,
        name: engagement.engagementType.name,
        code: engagement.engagementType.code,
        category: engagement.engagementType.category,
        recurrence: engagement.engagementType.recurrence,
      },
      taskProgress,
    };
  }
}
