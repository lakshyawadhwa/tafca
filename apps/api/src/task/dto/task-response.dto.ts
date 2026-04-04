import { TaskStatus, TaskPriority } from '@ca-practice-os/shared';

export interface ChecklistProgress {
  completed: number;
  total: number;
}

export interface RelatedClient {
  id: string;
  displayName: string;
}

export interface RelatedEngagement {
  id: string;
  name: string;
}

export interface RelatedUser {
  id: string;
  fullName: string;
}

export interface RelatedParentTask {
  id: string;
  title: string;
}

export interface TaskResponseDto {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  engagementId: string | null;
  clientId: string | null;
  parentTaskId: string | null;
  assigneeId: string | null;
  reviewerId: string | null;
  dueDate: string | null;
  internalDueDate: string | null;
  tags: string[];
  completedAt: string | null;
  cancelledAt: string | null;
  isRecurring: boolean;
  estimatedHours: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;

  // Computed fields
  checklistProgress: ChecklistProgress;
  isBlocked: boolean;
  subtaskCount: number;

  // Relations
  client: RelatedClient | null;
  engagement: RelatedEngagement | null;
  assignee: RelatedUser | null;
  reviewer: RelatedUser | null;
  parentTask: RelatedParentTask | null;
}

export interface TaskListItemDto {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  reviewerId: string | null;
  dueDate: string | null;
  tags: string[];
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;

  // Computed fields
  checklistProgress: ChecklistProgress;
  isBlocked: boolean;
  subtaskCount: number;

  // Relations
  client: RelatedClient | null;
  engagement: RelatedEngagement | null;
  assignee: RelatedUser | null;
}

export interface TaskListResponseDto {
  data: TaskListItemDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ActivityEntryDto {
  id: string;
  action: string;
  oldValue: any;
  newValue: any;
  occurredAt: string;
  actor: RelatedUser;
}

export interface ActivityListResponseDto {
  data: ActivityEntryDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
