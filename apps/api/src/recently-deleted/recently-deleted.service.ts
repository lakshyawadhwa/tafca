import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import { ListRecentlyDeletedQueryDto } from './dto/list-recently-deleted-query.dto';
import {
  RecentlyDeletedItemDto,
  RecentlyDeletedResponseDto,
} from './dto/recently-deleted-response.dto';

@Injectable()
export class RecentlyDeletedService extends FirmScopedService {
  private readonly logger = new Logger(RecentlyDeletedService.name);

  async listRecentlyDeleted(
    query?: ListRecentlyDeletedQueryDto,
  ): Promise<RecentlyDeletedResponseDto> {
    const firmId = this.getFirmId();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deletedWhere = {
      firmId,
      deletedAt: { not: null as Date | null, gte: thirtyDaysAgo },
    };

    const entityType = query?.entityType;

    // Run parallel queries (only the requested entity type, or all 3)
    const [clients, engagements, tasks] = await Promise.all([
      !entityType || entityType === 'Client'
        ? this.unscopedPrisma.client.findMany({
            where: deletedWhere,
            select: { id: true, displayName: true, deletedAt: true, deletedBy: true },
          })
        : Promise.resolve([]),

      !entityType || entityType === 'Engagement'
        ? this.unscopedPrisma.engagement.findMany({
            where: deletedWhere,
            select: { id: true, name: true, deletedAt: true, deletedBy: true },
          })
        : Promise.resolve([]),

      !entityType || entityType === 'Task'
        ? this.unscopedPrisma.task.findMany({
            where: deletedWhere,
            select: { id: true, title: true, deletedAt: true, deletedBy: true },
          })
        : Promise.resolve([]),
    ]);

    // Batch-fetch user names for all deletedBy UUIDs
    const allDeletedByIds = [
      ...clients.map((c) => c.deletedBy),
      ...engagements.map((e) => e.deletedBy),
      ...tasks.map((t) => t.deletedBy),
    ].filter((id): id is string => id !== null && id !== undefined);

    const uniqueDeletedByIds = [...new Set(allDeletedByIds)];
    let userMap: Record<string, string> = {};

    if (uniqueDeletedByIds.length > 0) {
      const users = await this.unscopedPrisma.user.findMany({
        where: { id: { in: uniqueDeletedByIds } },
        select: { id: true, fullName: true },
      });
      userMap = Object.fromEntries(users.map((u) => [u.id, u.fullName]));
    }

    const now = Date.now();

    // Merge results
    const items: RecentlyDeletedItemDto[] = [
      ...clients.map((c) => this.toDeletedItem('Client', c.id, c.displayName, c.deletedAt!, c.deletedBy, userMap, now)),
      ...engagements.map((e) => this.toDeletedItem('Engagement', e.id, e.name, e.deletedAt!, e.deletedBy, userMap, now)),
      ...tasks.map((t) => this.toDeletedItem('Task', t.id, t.title, t.deletedAt!, t.deletedBy, userMap, now)),
    ];

    // Sort by deletedAt DESC (newest first)
    items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

    return { data: items };
  }

  async restore(
    entityType: string,
    entityId: string,
  ): Promise<{ message: string }> {
    const firmId = this.getFirmId();
    const userId = this.getUserId();

    const findWhere = {
      id: entityId,
      firmId,
      deletedAt: { not: null as Date | null },
    };

    let record: { id: string; deletedAt: Date | null; displayName?: string } | null = null;

    switch (entityType) {
      case 'Client':
        record = await this.unscopedPrisma.client.findFirst({
          where: findWhere,
          select: { id: true, deletedAt: true, displayName: true },
        });
        break;
      case 'Engagement':
        record = await this.unscopedPrisma.engagement.findFirst({
          where: findWhere,
          select: { id: true, deletedAt: true },
        });
        break;
      case 'Task':
        record = await this.unscopedPrisma.task.findFirst({
          where: findWhere,
          select: { id: true, deletedAt: true },
        });
        break;
      default:
        throw new BadRequestException(`Invalid entity type: ${entityType}`);
    }

    if (!record) {
      throw new NotFoundException(
        `${entityType} not found or not deleted`,
      );
    }

    // Validate 30-day window
    const daysSinceDeletion = Math.floor(
      (Date.now() - record.deletedAt!.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceDeletion > 30) {
      throw new BadRequestException(
        'Record has expired and cannot be restored',
      );
    }

    // Unique constraint check for clients
    if (entityType === 'Client' && record.displayName) {
      const duplicate = await this.unscopedPrisma.client.findFirst({
        where: {
          firmId,
          displayName: record.displayName,
          deletedAt: null,
          id: { not: entityId },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `Cannot restore: a client named '${record.displayName}' already exists`,
        );
      }
    }

    // Restore the record
    const restoreData = {
      deletedAt: null as Date | null,
      deletedBy: null as string | null,
      updatedBy: userId,
    };

    switch (entityType) {
      case 'Client':
        await this.unscopedPrisma.client.update({
          where: { id: entityId },
          data: restoreData,
        });
        break;
      case 'Engagement':
        await this.unscopedPrisma.engagement.update({
          where: { id: entityId },
          data: restoreData,
        });
        break;
      case 'Task':
        await this.unscopedPrisma.task.update({
          where: { id: entityId },
          data: restoreData,
        });
        break;
    }

    return { message: 'Restored successfully' };
  }

  private toDeletedItem(
    entityType: string,
    entityId: string,
    name: string,
    deletedAt: Date,
    deletedBy: string | null,
    userMap: Record<string, string>,
    now: number,
  ): RecentlyDeletedItemDto {
    const daysSince = Math.floor(
      (now - deletedAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysRemaining = Math.max(0, 30 - daysSince);

    return {
      entityType,
      entityId,
      name,
      deletedAt,
      deletedByName: deletedBy ? (userMap[deletedBy] ?? 'Unknown') : 'Unknown',
      daysRemaining,
    };
  }
}
