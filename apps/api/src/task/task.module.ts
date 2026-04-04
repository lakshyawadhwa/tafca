import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { TaskActivityService } from './task-activity.service';
import { TaskNotificationHelper } from './task-notification.helper';

@Module({
  controllers: [TaskController],
  providers: [TaskService, TaskActivityService, TaskNotificationHelper],
  exports: [TaskService],
})
export class TaskModule {}
