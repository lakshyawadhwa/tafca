import { Injectable, Logger } from '@nestjs/common';
import { TaskAction } from '@ca-practice-os/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import {
  ActivityEntryDto,
  ActivityListResponseDto,
  RelatedUser,
} from './dto/task-response.dto';

@Injectable()
export class TaskActivityService extends FirmScopedService {
  private readonly logger = new Logger(TaskActivityService.name);

  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  /**
   * Log a task activity entry. Fire-and-forget — never throws.
   * Called from TaskService on every mutation.
   */
  async log(
    taskId: string,
    action: TaskAction,
    oldValue?: any,
    newValue?: any,
  ): Promise<void> {
    try {
      await this.prisma.taskActivityLog.create({
        data: {
          taskId,
          firmId: this.getFirmId(),
          actorId: this.getUserId(),
          action,
          oldValue: oldValue !== undefined ? oldValue : undefined,
          newValue: newValue !== undefined ? newValue : undefined,
          occurredAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to log activity for task ${taskId}: ${error}`,
      );
    }
  }

  /**
   * Get paginated activity log for a task, newest first.
   */
  async getActivity(
    taskId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<ActivityListResponseDto> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.taskActivityLog.findMany({
        where: { taskId },
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
        select: {
          id: true,
          action: true,
          oldValue: true,
          newValue: true,
          occurredAt: true,
          actorId: true,
        },
      }),
      this.prisma.taskActivityLog.count({ where: { taskId } }),
    ]);

    // Fetch actor names in batch
    const actorIds = [...new Set(data.map((d: any) => d.actorId))];
    const actors =
      actorIds.length > 0
        ? await this.unscopedPrisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, fullName: true },
          })
        : [];
    const actorMap = new Map<string, RelatedUser>(
      actors.map((a) => [a.id, { id: a.id, fullName: a.fullName }]),
    );

    return {
      data: data.map(
        (entry: any): ActivityEntryDto => ({
          id: entry.id,
          action: entry.action,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          occurredAt: entry.occurredAt.toISOString(),
          actor: actorMap.get(entry.actorId) || {
            id: entry.actorId,
            fullName: 'Unknown User',
          },
        }),
      ),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
