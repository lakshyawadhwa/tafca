import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { TaskAction, LIMITS } from '@ca-practice-os/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import { TaskActivityService } from './task-activity.service';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

@Injectable()
export class TaskChecklistService extends FirmScopedService {
  private readonly logger = new Logger(TaskChecklistService.name);

  constructor(
    prismaService: PrismaService,
    private readonly activityService: TaskActivityService,
  ) {
    super(prismaService);
  }

  // ───────────────────────── Add Item ─────────────────────────

  async addItem(taskId: string, dto: CreateChecklistItemDto) {
    // Verify task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Max 30 enforcement
    const count = await this.prisma.taskChecklist.count({
      where: { taskId },
    });
    if (count >= LIMITS.MAX_CHECKLIST_ITEMS_PER_TASK) {
      throw new BadRequestException(
        `Maximum of ${LIMITS.MAX_CHECKLIST_ITEMS_PER_TASK} checklist items per task`,
      );
    }

    // Get next displayOrder
    const maxOrder = await this.prisma.taskChecklist.findFirst({
      where: { taskId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });
    const displayOrder = maxOrder ? maxOrder.displayOrder + 1 : 0;

    const userId = this.getUserId();
    const item = await this.prisma.taskChecklist.create({
      data: {
        taskId,
        firmId: this.getFirmId(),
        label: dto.label,
        isRequired: dto.isRequired ?? true,
        displayOrder,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    this.logger.log(`Checklist item added to task ${taskId}: ${item.id}`);
    return item;
  }

  // ───────────────────────── Update Item (incl. toggle) ─────────────────────────

  async updateItem(
    taskId: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
  ) {
    const item = await this.prisma.taskChecklist.findFirst({
      where: { id: itemId, taskId },
    });
    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }

    const userId = this.getUserId();
    const updateData: Record<string, any> = {
      updatedBy: userId,
    };

    // Handle toggle with activity logging
    if (dto.isCompleted !== undefined && dto.isCompleted !== item.isCompleted) {
      if (dto.isCompleted) {
        // Toggling to completed
        updateData.isCompleted = true;
        updateData.completedAt = new Date();
        updateData.completedBy = userId;
        // Fire-and-forget activity log
        this.activityService
          .log(taskId, TaskAction.CHECKLIST_ITEM_COMPLETED, null, item.label)
          .catch(() => {});
      } else {
        // Toggling to uncompleted
        updateData.isCompleted = false;
        updateData.completedAt = null;
        updateData.completedBy = null;
        // Fire-and-forget activity log
        this.activityService
          .log(
            taskId,
            TaskAction.CHECKLIST_ITEM_UNCOMPLETED,
            null,
            item.label,
          )
          .catch(() => {});
      }
    }

    if (dto.label !== undefined) updateData.label = dto.label;
    if (dto.isRequired !== undefined) updateData.isRequired = dto.isRequired;
    if (dto.displayOrder !== undefined)
      updateData.displayOrder = dto.displayOrder;

    const updated = await this.prisma.taskChecklist.update({
      where: { id: itemId },
      data: updateData,
    });

    return updated;
  }

  // ───────────────────────── Delete Item ─────────────────────────

  async deleteItem(taskId: string, itemId: string): Promise<void> {
    const item = await this.prisma.taskChecklist.findFirst({
      where: { id: itemId, taskId },
    });
    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }

    await this.prisma.taskChecklist.update({
      where: { id: itemId },
      data: {
        deletedAt: new Date(),
        deletedBy: this.getUserId(),
      },
    });

    this.logger.log(`Checklist item deleted: ${itemId} from task ${taskId}`);
  }

  // ───────────────────────── List Items ─────────────────────────

  async listItems(taskId: string) {
    return this.prisma.taskChecklist.findMany({
      where: { taskId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  // ───────────────────────── Reorder Items ─────────────────────────

  async reorderItems(taskId: string, itemIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      itemIds.map((id, i) =>
        this.prisma.taskChecklist.update({
          where: { id },
          data: { displayOrder: i },
        }),
      ),
    );

    this.logger.log(
      `Checklist items reordered for task ${taskId}: ${itemIds.length} items`,
    );
  }
}
