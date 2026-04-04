import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { TaskAction, TaskStatus } from '@ca-practice-os/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import { TaskActivityService } from './task-activity.service';
import { TaskNotificationHelper } from './task-notification.helper';
import { CreateDependencyDto } from './dto/create-dependency.dto';

@Injectable()
export class TaskDependencyService extends FirmScopedService {
  private readonly logger = new Logger(TaskDependencyService.name);

  constructor(
    prismaService: PrismaService,
    private readonly activityService: TaskActivityService,
    private readonly notificationHelper: TaskNotificationHelper,
  ) {
    super(prismaService);
  }

  // ───────────────────────── Add Dependency ─────────────────────────

  async addDependency(taskId: string, dto: CreateDependencyDto) {
    // 1. Self-dependency check
    if (taskId === dto.dependsOnTaskId) {
      throw new BadRequestException('A task cannot depend on itself');
    }

    // 2. Verify both tasks exist in same firm
    const [task, predecessor] = await Promise.all([
      this.prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, title: true },
      }),
      this.prisma.task.findUnique({
        where: { id: dto.dependsOnTaskId },
        select: { id: true, title: true },
      }),
    ]);

    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (!predecessor) {
      throw new NotFoundException('Predecessor task not found');
    }

    // 3. Check for existing duplicate
    const existing = await this.prisma.taskDependency.findFirst({
      where: {
        taskId,
        dependsOnTaskId: dto.dependsOnTaskId,
      },
    });
    if (existing) {
      throw new ConflictException('Dependency already exists');
    }

    // 4. Cycle detection via BFS
    const hasCycle = await this.hasCycle(taskId, dto.dependsOnTaskId);
    if (hasCycle) {
      throw new BadRequestException(
        'Cannot add dependency: circular dependency detected',
      );
    }

    // 5. Create dependency record
    const dependency = await this.prisma.taskDependency.create({
      data: {
        firmId: this.getFirmId(),
        taskId,
        dependsOnTaskId: dto.dependsOnTaskId,
      },
      include: {
        dependsOnTask: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    // 6. Fire-and-forget activity log
    this.activityService
      .log(taskId, TaskAction.DEPENDENCY_ADDED, null, predecessor.title)
      .catch(() => {});

    this.logger.log(
      `Dependency added: task ${taskId} depends on ${dto.dependsOnTaskId}`,
    );

    return dependency;
  }

  // ───────────────────────── Remove Dependency ─────────────────────────

  async removeDependency(
    taskId: string,
    dependsOnTaskId: string,
  ): Promise<void> {
    const dependency = await this.prisma.taskDependency.findFirst({
      where: { taskId, dependsOnTaskId },
      select: {
        id: true,
        dependsOnTask: { select: { title: true } },
      },
    });

    if (!dependency) {
      throw new NotFoundException('Dependency not found');
    }

    await this.prisma.taskDependency.delete({
      where: { id: dependency.id },
    });

    // Fire-and-forget activity log
    this.activityService
      .log(
        taskId,
        TaskAction.DEPENDENCY_REMOVED,
        dependency.dependsOnTask.title,
        null,
      )
      .catch(() => {});

    this.logger.log(
      `Dependency removed: task ${taskId} no longer depends on ${dependsOnTaskId}`,
    );
  }

  // ───────────────────────── Get Dependencies ─────────────────────────

  async getDependencies(taskId: string) {
    const [blockedBy, blocking] = await Promise.all([
      this.prisma.taskDependency.findMany({
        where: { taskId },
        include: {
          dependsOnTask: {
            select: { id: true, title: true, status: true },
          },
        },
      }),
      this.prisma.taskDependency.findMany({
        where: { dependsOnTaskId: taskId },
        include: {
          task: {
            select: { id: true, title: true, status: true },
          },
        },
      }),
    ]);

    return { blockedBy, blocking };
  }

  // ───────────────────────── BFS Cycle Detection ─────────────────────────

  /**
   * BFS from dependsOnTaskId walking all its dependsOn edges.
   * If we reach taskId, a cycle would be created.
   *
   * Example: if adding "A depends on B", we BFS from B.
   * If B -> C -> A exists, then adding A -> B creates cycle A -> B -> ... -> A.
   */
  private async hasCycle(
    taskId: string,
    dependsOnTaskId: string,
  ): Promise<boolean> {
    const visited = new Set<string>();
    const queue: string[] = [dependsOnTaskId];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === taskId) {
        return true; // Cycle detected
      }

      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      // Get all tasks that 'current' depends on (firm-scoped)
      const deps = await this.prisma.taskDependency.findMany({
        where: { taskId: current },
        select: { dependsOnTaskId: true },
      });

      for (const dep of deps) {
        if (!visited.has(dep.dependsOnTaskId)) {
          queue.push(dep.dependsOnTaskId);
        }
      }
    }

    return false;
  }
}
