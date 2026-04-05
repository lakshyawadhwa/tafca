import { Controller, Get, Post, Query, Param } from '@nestjs/common';
import { RecentlyDeletedService } from './recently-deleted.service';
import { ListRecentlyDeletedQueryDto } from './dto/list-recently-deleted-query.dto';
import { RecentlyDeletedResponseDto } from './dto/recently-deleted-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@ca-practice-os/shared';

@Controller('recently-deleted')
export class RecentlyDeletedController {
  constructor(
    private readonly recentlyDeletedService: RecentlyDeletedService,
  ) {}

  @Get()
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async listRecentlyDeleted(
    @Query() query: ListRecentlyDeletedQueryDto,
  ): Promise<RecentlyDeletedResponseDto> {
    return this.recentlyDeletedService.listRecentlyDeleted(query);
  }

  @Post(':entityType/:entityId/restore')
  @Roles(UserRole.PARTNER)
  async restore(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<{ message: string }> {
    return this.recentlyDeletedService.restore(entityType, entityId);
  }
}
