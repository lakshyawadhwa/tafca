import { TaskStatus } from '../enums/task-status.enum.js';

export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TO_DO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.IN_PROGRESS]: [
    TaskStatus.AWAITING_CLIENT,
    TaskStatus.UNDER_REVIEW,
    TaskStatus.PARTNER_APPROVAL,
    TaskStatus.TO_DO,
    TaskStatus.CANCELLED,
  ],
  [TaskStatus.AWAITING_CLIENT]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.UNDER_REVIEW]: [
    TaskStatus.IN_PROGRESS,
    TaskStatus.PARTNER_APPROVAL,
    TaskStatus.DONE,
    TaskStatus.CANCELLED,
  ],
  [TaskStatus.PARTNER_APPROVAL]: [
    TaskStatus.UNDER_REVIEW,
    TaskStatus.IN_PROGRESS,
    TaskStatus.DONE,
    TaskStatus.CANCELLED,
  ],
  [TaskStatus.DONE]: [],
  [TaskStatus.CANCELLED]: [],
};
