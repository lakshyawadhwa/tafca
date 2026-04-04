import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import { TaskActivityService } from './task-activity.service';
import { TaskNotificationHelper } from './task-notification.helper';

@Injectable()
export class TaskService extends FirmScopedService {
  constructor(
    prismaService: PrismaService,
    private readonly activityService: TaskActivityService,
    private readonly notificationHelper: TaskNotificationHelper,
  ) {
    super(prismaService);
  }

  // Stub — full implementation in Task 2
}
