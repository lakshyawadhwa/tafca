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
  // ADMIN can delete records and list the bin, so withholding restore left it
  // able to remove things it could not put back.
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async restore(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<{ message: string }> {
    return this.recentlyDeletedService.restore(entityType, entityId);
  }
}
