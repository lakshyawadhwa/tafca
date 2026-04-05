import {
  Controller,
  Get,
  Patch,
  Query,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  NotificationDto,
  PaginatedNotificationResponseDto,
} from './dto/notification-response.dto';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async listNotifications(
    @Query() query: ListNotificationsQueryDto,
  ): Promise<PaginatedNotificationResponseDto> {
    return this.notificationService.listNotifications(query);
  }

  /**
   * IMPORTANT: unread-count must be defined BEFORE :id routes
   * to avoid NestJS treating "unread-count" as a UUID param.
   */
  @Get('unread-count')
  async getUnreadCount(): Promise<{ count: number }> {
    return this.notificationService.getUnreadCount();
  }

  @Patch('read-all')
  async markAllRead(): Promise<{ updatedCount: number }> {
    return this.notificationService.markAllRead();
  }

  @Patch(':id/read')
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NotificationDto> {
    return this.notificationService.markRead(id);
  }
}
