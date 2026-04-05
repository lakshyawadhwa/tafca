import { Injectable, Logger } from '@nestjs/common';
import {
  TaskStatus,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
} from '@ca-practice-os/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirmScopedService } from '../common/base/firm-scoped.service';

interface TaskContext {
  id: string;
  title: string;
  assigneeId: string | null;
  reviewerId: string | null;
  engagementId: string | null;
  clientId: string | null;
}

@Injectable()
export class TaskNotificationHelper extends FirmScopedService {
  private readonly logger = new Logger(TaskNotificationHelper.name);

  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  /**
   * Emit notifications based on status transitions.
   * Fire-and-forget — never throws.
   */
  async onStatusChange(
    task: TaskContext,
    oldStatus: TaskStatus,
    newStatus: TaskStatus,
  ): Promise<void> {
    try {
      // IN_PROGRESS -> UNDER_REVIEW: notify reviewer
      if (
        oldStatus === TaskStatus.IN_PROGRESS &&
        newStatus === TaskStatus.UNDER_REVIEW &&
        task.reviewerId
      ) {
        await this.createNotification(
          task.reviewerId,
          NotificationType.TASK_REVIEW_REQUESTED,
          'Task review requested',
          `'${task.title}' is ready for your review`,
          'Task',
          task.id,
        );
      }

      // UNDER_REVIEW -> PARTNER_APPROVAL: notify partner (from engagement or client)
      if (
        oldStatus === TaskStatus.UNDER_REVIEW &&
        newStatus === TaskStatus.PARTNER_APPROVAL
      ) {
        const partnerId = await this.resolvePartnerId(task);
        if (partnerId) {
          await this.createNotification(
            partnerId,
            NotificationType.TASK_APPROVAL_REQUESTED,
            'Task approval requested',
            `'${task.title}' requires your approval`,
            'Task',
            task.id,
          );
        }
      }

      // UNDER_REVIEW/PARTNER_APPROVAL -> IN_PROGRESS: sent back to assignee
      if (
        (oldStatus === TaskStatus.UNDER_REVIEW ||
          oldStatus === TaskStatus.PARTNER_APPROVAL) &&
        newStatus === TaskStatus.IN_PROGRESS &&
        task.assigneeId
      ) {
        await this.createNotification(
          task.assigneeId,
          NotificationType.TASK_SENT_BACK,
          'Task sent back',
          `'${task.title}' has been sent back for revision`,
          'Task',
          task.id,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to emit status change notification for task ${task.id}: ${error}`,
      );
    }
  }

  /**
   * Notify new assignee when task assignment changes.
   * Fire-and-forget — never throws.
   */
  async onAssigneeChange(
    task: TaskContext,
    _oldAssigneeId: string | null,
    newAssigneeId: string | null,
  ): Promise<void> {
    try {
      if (!newAssigneeId) return;

      await this.createNotification(
        newAssigneeId,
        NotificationType.TASK_ASSIGNED,
        'Task assigned',
        `You have been assigned to '${task.title}'`,
        'Task',
        task.id,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit assignee change notification for task ${task.id}: ${error}`,
      );
    }
  }

  /**
   * Notify assignee when all dependencies of their task are resolved.
   * Fire-and-forget — never throws.
   */
  async onDependencyUnblocked(
    taskId: string,
    taskTitle: string,
    assigneeId: string,
  ): Promise<void> {
    try {
      await this.createNotification(
        assigneeId,
        NotificationType.TASK_DEPENDENCY_UNBLOCKED,
        'Task unblocked',
        `All dependencies for '${taskTitle}' are now resolved`,
        'Task',
        taskId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit dependency unblocked notification for task ${taskId}: ${error}`,
      );
    }
  }

  /**
   * Notify mentioned users in a comment.
   * Fire-and-forget — never throws.
   */
  async onCommentMention(
    taskId: string,
    taskTitle: string,
    mentionedUserIds: string[],
  ): Promise<void> {
    try {
      for (const userId of mentionedUserIds) {
        await this.createNotification(
          userId,
          NotificationType.COMMENT_MENTION,
          'You were mentioned',
          `You were mentioned in a comment on '${taskTitle}'`,
          'Task',
          taskId,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to emit comment mention notifications for task ${taskId}: ${error}`,
      );
    }
  }

  // ───────────────────────── Private Helpers ─────────────────────────

  private async createNotification(
    recipientId: string,
    type: NotificationType,
    title: string,
    body: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    await this.unscopedPrisma.notification.create({
      data: {
        firmId: this.getFirmId(),
        recipientId,
        type,
        title,
        body,
        entityType,
        entityId,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      },
    });
  }

  /**
   * Resolve the partner for a task — from engagement or client.
   */
  private async resolvePartnerId(
    task: TaskContext,
  ): Promise<string | null> {
    if (task.engagementId) {
      const engagement = await this.prisma.engagement.findUnique({
        where: { id: task.engagementId },
        select: { assignedPartnerId: true },
      });
      if (engagement?.assignedPartnerId) {
        return engagement.assignedPartnerId;
      }
    }

    if (task.clientId) {
      const client = await this.prisma.client.findUnique({
        where: { id: task.clientId },
        select: { assignedPartnerId: true },
      });
      if (client?.assignedPartnerId) {
        return client.assignedPartnerId;
      }
    }

    return null;
  }
}
