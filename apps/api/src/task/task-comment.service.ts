import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { TaskAction } from '@ca-practice-os/shared';
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
    const mentions = dto.mentions || [];

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        firmId: this.getFirmId(),
        authorId: userId,
        body: dto.body,
        mentions,
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
    if (mentions.length > 0) {
      this.notificationHelper
        .onCommentMention(taskId, task.title, mentions)
        .catch(() => {});
    }

    this.logger.log(`Comment added to task ${taskId}: ${comment.id}`);

    // Return comment with author info
    const author = await this.unscopedPrisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true },
    });

    return {
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      author: author || { id: userId, fullName: 'Unknown User' },
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
    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId, taskId },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Ownership check
    if (comment.authorId !== this.getUserId()) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.taskComment.update({
      where: { id: commentId },
      data: {
        deletedAt: new Date(),
        deletedBy: this.getUserId(),
      },
    });

    this.logger.log(`Comment deleted: ${commentId} from task ${taskId}`);
  }

  // ───────────────────────── List Comments ─────────────────────────

  async listComments(taskId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    // Fetch top-level comments (no parent), newest first
    const [topLevelComments, total] = await Promise.all([
      this.prisma.taskComment.findMany({
        where: {
          taskId,
          parentCommentId: null,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          body: true,
          mentions: true,
          authorId: true,
          parentCommentId: true,
          createdAt: true,
          updatedAt: true,
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
            },
          },
        },
      }),
      this.prisma.taskComment.count({
        where: {
          taskId,
          parentCommentId: null,
        },
      }),
    ]);

    // Batch-fetch author info for all unique authorIds
    const allComments = topLevelComments.flatMap((c: any) => [
      c,
      ...c.replies,
    ]);
    const authorIds = [
      ...new Set(allComments.map((c: any) => c.authorId)),
    ] as string[];

    const authors =
      authorIds.length > 0
        ? await this.unscopedPrisma.user.findMany({
            where: { id: { in: authorIds } },
            select: { id: true, fullName: true },
          })
        : [];
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    const mapComment = (c: any) => ({
      id: c.id,
      body: c.body,
      mentions: c.mentions,
      authorId: c.authorId,
      parentCommentId: c.parentCommentId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      author: authorMap.get(c.authorId) || {
        id: c.authorId,
        fullName: 'Unknown User',
      },
    });

    const data = topLevelComments.map((c: any) => ({
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
