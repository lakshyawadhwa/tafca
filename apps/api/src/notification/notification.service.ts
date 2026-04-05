import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationStatus } from '@ca-practice-os/shared';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  NotificationDto,
  PaginatedNotificationResponseDto,
} from './dto/notification-response.dto';

@Injectable()
export class NotificationService extends FirmScopedService {
  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  /**
   * List notifications for the current user with pagination.
   * Always returns unreadCount regardless of filters.
   */
  async listNotifications(
    query: ListNotificationsQueryDto,
  ): Promise<PaginatedNotificationResponseDto> {
    const { page = 1, limit = 20, unreadOnly } = query;
    const skip = (page - 1) * limit;
    const recipientId = this.getUserId();

    const where: Record<string, any> = { recipientId };
    if (unreadOnly) {
      where.readAt = null;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { recipientId, readAt: null },
      }),
    ]);

    return {
      data: notifications.map((n) => this.toDto(n)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  /**
   * Mark a single notification as read.
   * Ensures the notification belongs to the current user.
   */
  async markRead(notificationId: string): Promise<NotificationDto> {
    const recipientId = this.getUserId();

    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
    });

    return this.toDto(updated);
  }

  /**
   * Mark all unread notifications as read for the current user.
   */
  async markAllRead(): Promise<{ updatedCount: number }> {
    const recipientId = this.getUserId();

    const result = await this.prisma.notification.updateMany({
      where: { recipientId, readAt: null },
      data: {
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
    });

    return { updatedCount: result.count };
  }

  /**
   * Get the unread notification count for the current user.
   * Lightweight endpoint for the bell badge.
   */
  async getUnreadCount(): Promise<{ count: number }> {
    const recipientId = this.getUserId();

    const count = await this.prisma.notification.count({
      where: { recipientId, readAt: null },
    });

    return { count };
  }

  // ───────────────────────── Private Helpers ─────────────────────────

  private toDto(notification: any): NotificationDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      entityType: notification.entityType,
      entityId: notification.entityId,
      channel: notification.channel,
      status: notification.status,
      sentAt: notification.sentAt?.toISOString() ?? null,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
