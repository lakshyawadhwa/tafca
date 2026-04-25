import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { TaskAction, UserRole } from '@ca-practice-os/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import { TaskActivityService } from './task-activity.service';
import { TaskNotificationHelper } from './task-notification.helper';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class TaskCommentService extends FirmScopedService {
  private readonly logger = new Logger(TaskCommentService.name);

  constructor(
    prismaService: PrismaService,
    private readonly activityService: TaskActivityService,
    private readonly notificationHelper: TaskNotificationHelper,
  ) {
    super(prismaService);
  }

  // ───────────────────────── Add Comment ─────────────────────────

  async addComment(taskId: string, dto: CreateCommentDto) {
    // Verify task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Threading depth-1 enforcement
    if (dto.parentCommentId) {
      const parentComment = await this.prisma.taskComment.findFirst({
        where: { id: dto.parentCommentId, taskId },
      });
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }
      if (parentComment.parentCommentId !== null) {
        throw new BadRequestException(
          'Reply depth limited to 1 level — cannot reply to a reply',
        );
      }
    }

    const userId = this.getUserId();
    const mentionIds = dto.mentions || [];

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        firmId: this.getFirmId(),
        authorId: userId,
        body: dto.body,
        mentions: mentionIds,
        parentCommentId: dto.parentCommentId || null,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Fire-and-forget: activity log
    this.activityService
      .log(
        taskId,
        TaskAction.COMMENT_ADDED,
        null,
        dto.body.substring(0, 100),
      )
      .catch(() => {});

    // Fire-and-forget: mention notifications
    if (mentionIds.length > 0) {
      this.notificationHelper
        .onCommentMention(taskId, task.title, mentionIds)
        .catch(() => {});
    }

    this.logger.log(`Comment added to task ${taskId}: ${comment.id}`);

    // Batch-fetch author + mentioned users for hydrated response
    const allUserIds = [userId, ...mentionIds.filter((id) => id !== userId)];
    const users = await this.unscopedPrisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, fullName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      deletedAt: comment.deletedAt ? comment.deletedAt.toISOString() : null,
      author: userMap.get(userId) || { id: userId, fullName: 'Unknown User' },
      mentions: mentionIds.map((id) => userMap.get(id) || { id, fullName: 'Unknown User' }),
    };
  }

  // ───────────────────────── Update Comment ─────────────────────────

  async updateComment(
    taskId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId, taskId },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Ownership check
    if (comment.authorId !== this.getUserId()) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const updateData: Record<string, any> = {
      updatedBy: this.getUserId(),
    };

    if (dto.body !== undefined) updateData.body = dto.body;
    if (dto.mentions !== undefined) updateData.mentions = dto.mentions;

    const updated = await this.prisma.taskComment.update({
      where: { id: commentId },
      data: updateData,
    });

    return updated;
  }

  // ───────────────────────── Delete Comment ─────────────────────────

  async deleteComment(taskId: string, commentId: string): Promise<void> {
    const userId = this.getUserId();

    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId, taskId },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // ADMIN can delete any comment; others only their own
    if (comment.authorId !== userId) {
      const currentUser = await this.unscopedPrisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (currentUser?.role !== UserRole.ADMIN) {
        throw new ForbiddenException('You can only delete your own comments');
      }
    }

    await this.prisma.taskComment.update({
      where: { id: commentId },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    this.logger.log(`Comment deleted: ${commentId} from task ${taskId}`);
  }

  // ───────────────────────── List Comments ─────────────────────────

  async listComments(taskId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    // Fetch top-level comments including soft-deleted ones (we need them if they have replies).
    // We pass deletedAt: undefined to bypass the extension's auto-filter and handle manually.
    const [topLevelComments, total] = await Promise.all([
      this.prisma.taskComment.findMany({
        where: {
          taskId,
          parentCommentId: null,
          deletedAt: undefined, // bypass soft-delete extension filter
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          body: true,
          mentions: true,
          authorId: true,
          parentCommentId: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          replies: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              body: true,
              mentions: true,
              authorId: true,
              parentCommentId: true,
              createdAt: true,
              updatedAt: true,
              deletedAt: true,
            },
          },
        },
      }),
      this.prisma.taskComment.count({
        where: {
          taskId,
          parentCommentId: null,
          deletedAt: null,
        },
      }),
    ]);

    // Filter out soft-deleted top-level comments with no replies (omit entirely per spec)
    const visibleTopLevel = topLevelComments.filter(
      (c: any) => c.deletedAt === null || c.replies.length > 0,
    );

    // Collect all unique user IDs (authors + mentioned)
    const allComments = visibleTopLevel.flatMap((c: any) => [c, ...c.replies]);
    const allUserIds = new Set<string>();
    for (const c of allComments) {
      allUserIds.add(c.authorId);
      for (const id of c.mentions ?? []) {
        allUserIds.add(id);
      }
    }

    const users =
      allUserIds.size > 0
        ? await this.unscopedPrisma.user.findMany({
            where: { id: { in: [...allUserIds] } },
            select: { id: true, fullName: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const mapComment = (c: any) => ({
      id: c.id,
      body: c.body,
      mentions: (c.mentions ?? []).map(
        (id: string) => userMap.get(id) || { id, fullName: 'Unknown User' },
      ),
      authorId: c.authorId,
      parentCommentId: c.parentCommentId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
      author: userMap.get(c.authorId) || {
        id: c.authorId,
        fullName: 'Unknown User',
      },
    });

    const data = visibleTopLevel.map((c: any) => ({
      ...mapComment(c),
      replies: c.replies.map(mapComment),
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
