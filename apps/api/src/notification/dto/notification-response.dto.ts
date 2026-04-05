import {
  NotificationType,
  NotificationChannel,
  NotificationStatus,
} from '@ca-practice-os/shared';

export class NotificationDto {
  id!: string;
  type!: NotificationType;
  title!: string;
  body!: string;
  entityType!: string | null;
  entityId!: string | null;
  channel!: NotificationChannel;
  status!: NotificationStatus;
  sentAt!: string | null;
  readAt!: string | null;
  createdAt!: string;
}

export class PaginatedNotificationResponseDto {
  data!: NotificationDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    unreadCount: number;
  };
}
