import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@ca-practice-os/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentFirm } from '../auth/decorators/current-firm.decorator';
import { ActionLogService } from './action-log.service';
import { ListActionLogQueryDto } from './dto/list-action-log-query.dto';
import { PaginatedActionLogResponseDto } from './dto/action-log-response.dto';

@Controller('audit-log')
export class ActionLogController {
  constructor(private readonly actionLogService: ActionLogService) {}

  @Get()
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async listActionLogs(
    @CurrentFirm() firmId: string,
    @Query() query: ListActionLogQueryDto,
  ): Promise<PaginatedActionLogResponseDto> {
    return this.actionLogService.listActionLogs(firmId, query);
  }
}
