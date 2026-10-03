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

  // Read-only for everyone who can see it. MANAGER runs delivery and needs to
  // answer "who changed this" without escalating to a partner. There is no
  // write route on this controller at any role — see the append-only trigger
  // in migration 20261003050000.
  @Get()
  @Roles(UserRole.PARTNER, UserRole.ADMIN, UserRole.MANAGER)
  async listActionLogs(
    @CurrentFirm() firmId: string,
    @Query() query: ListActionLogQueryDto,
  ): Promise<PaginatedActionLogResponseDto> {
    return this.actionLogService.listActionLogs(firmId, query);
  }
}
