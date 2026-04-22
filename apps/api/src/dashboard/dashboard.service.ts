import { Injectable, Logger } from '@nestjs/common';
import { TaskStatus, UserRole } from '@ca-practice-os/shared';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import {
  DashboardResponseDto,
  DashboardTaskDto,
  DashboardNotificationDto,
  TaskSummaryDto,
  OnboardingStatusDto,
} from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService extends FirmScopedService {
  private readonly logger = new Logger(DashboardService.name);

  async getDashboard(userId: string, userRole: string): Promise<DashboardResponseDto> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const activeStatuses = { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] };
    const isReviewer = userRole === UserRole.PARTNER || userRole === UserRole.MANAGER;

    const firmId = this.getFirmId();

    const [
      overdueCount,
      dueTodayCount,
      dueThisWeekCount,
      inReviewCount,
      myTasks,
      approvalQueue,
      recentNotifications,
      firmProfile,
      teamCount,
      clientCount,
    ] = await Promise.all([
      // a. Overdue count
      this.prisma.task.count({
        where: {
          assigneeId: userId,
          status: activeStatuses,
          dueDate: { lt: today },
        },
      }),

      // b. Due today count
      this.prisma.task.count({
        where: {
          assigneeId: userId,
          status: activeStatuses,
          dueDate: { gte: today, lt: tomorrow },
        },
      }),

      // c. Due this week count
      this.prisma.task.count({
        where: {
          assigneeId: userId,
          status: activeStatuses,
          dueDate: { gte: today, lte: weekFromNow },
        },
      }),

      // d. In review count (PARTNER/MANAGER only)
      isReviewer
        ? this.prisma.task.count({
            where: {
              status: TaskStatus.PARTNER_APPROVAL,
              reviewerId: userId,
            },
          })
        : Promise.resolve(0),

      // e. My tasks (top 10)
      this.prisma.task.findMany({
        where: {
          assigneeId: userId,
          status: activeStatuses,
        },
        orderBy: [{ dueDate: 'asc' }],
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          client: { select: { displayName: true } },
        },
      }),

      // f. Approval queue (PARTNER/MANAGER only, top 10)
      isReviewer
        ? this.prisma.task.findMany({
            where: {
              status: TaskStatus.PARTNER_APPROVAL,
              reviewerId: userId,
            },
            orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
            take: 10,
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              client: { select: { displayName: true } },
              assigneeId: true,
            },
          })
        : Promise.resolve([]),

      // g. Recent notifications (latest 5)
      this.prisma.notification.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // h. Firm profile (for onboarding check)
      this.unscopedPrisma.firm.findFirst({
        where: { id: firmId },
        select: { icaiRegistration: true, pan: true },
      }),

      // i. Team member count (for onboarding check)
      this.unscopedPrisma.user.count({
        where: { firmId, deletedAt: null, isActive: true },
      }),

      // j. Client count (for onboarding check)
      this.prisma.client.count(),
    ]);

    // Batch-fetch assignee names for approval queue
    const assigneeIds = (approvalQueue as any[])
      .map((t) => t.assigneeId)
      .filter(Boolean);
    const uniqueAssigneeIds = [...new Set(assigneeIds)];
    let assigneeMap: Record<string, string> = {};

    if (uniqueAssigneeIds.length > 0) {
      const users = await this.unscopedPrisma.user.findMany({
        where: { id: { in: uniqueAssigneeIds } },
        select: { id: true, fullName: true },
      });
      assigneeMap = Object.fromEntries(users.map((u) => [u.id, u.fullName]));
    }

    const taskSummary: TaskSummaryDto = {
      overdue: overdueCount,
      dueToday: dueTodayCount,
      dueThisWeek: dueThisWeekCount,
      inReview: inReviewCount,
    };

    const mappedMyTasks: DashboardTaskDto[] = (myTasks as any[]).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      clientName: t.client?.displayName ?? undefined,
    }));

    const mappedApprovalQueue: DashboardTaskDto[] = (approvalQueue as any[]).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      clientName: t.client?.displayName ?? undefined,
      assigneeName: assigneeMap[t.assigneeId] ?? undefined,
    }));

    const mappedNotifications: DashboardNotificationDto[] = (recentNotifications as any[]).map(
      (n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        entityType: n.entityType,
        entityId: n.entityId,
        createdAt: n.createdAt,
        readAt: n.readAt,
      }),
    );

    const firmProfileDone = !!(firmProfile?.icaiRegistration || firmProfile?.pan);
    const teamInvited = teamCount > 1;
    const clientAdded = clientCount > 0;

    const onboarding: OnboardingStatusDto = {
      firmProfileDone,
      teamInvited,
      clientAdded,
      allDone: firmProfileDone && teamInvited && clientAdded,
    };

    return {
      taskSummary,
      myTasks: mappedMyTasks,
      approvalQueue: mappedApprovalQueue,
      recentNotifications: mappedNotifications,
      onboarding,
    };
  }
}
