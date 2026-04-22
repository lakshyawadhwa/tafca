export interface TaskSummaryDto {
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  inReview: number;
}

export interface DashboardTaskDto {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  clientName?: string;
  assigneeName?: string;
}

export interface DashboardNotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
  readAt: Date | null;
}

export interface OnboardingStatusDto {
  firmProfileDone: boolean;
  teamInvited: boolean;
  clientAdded: boolean;
  allDone: boolean;
}

export interface DashboardResponseDto {
  taskSummary: TaskSummaryDto;
  myTasks: DashboardTaskDto[];
  approvalQueue: DashboardTaskDto[];
  recentNotifications: DashboardNotificationDto[];
  onboarding: OnboardingStatusDto;
}
