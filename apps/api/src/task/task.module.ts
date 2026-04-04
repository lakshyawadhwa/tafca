import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { TaskActivityService } from './task-activity.service';
import { TaskNotificationHelper } from './task-notification.helper';
import { TaskChecklistService } from './task-checklist.service';
import { TaskDependencyService } from './task-dependency.service';
import { TaskCommentService } from './task-comment.service';

@Module({
  controllers: [TaskController],
  providers: [
    TaskService,
    TaskActivityService,
    TaskNotificationHelper,
    TaskChecklistService,
    TaskDependencyService,
    TaskCommentService,
  ],
  exports: [TaskService],
})
export class TaskModule {}
