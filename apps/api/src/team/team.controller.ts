import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserRole } from '@ca-practice-os/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { TeamService } from './team.service';
import { LeaveService } from './leave.service';
import { WorkloadResponseDto } from './dto/workload-response.dto';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { ListLeaveQueryDto } from './dto/list-leave-query.dto';
import { LeaveDto, PaginatedLeaveResponseDto } from './dto/leave-response.dto';
import { ApprovalQueueQueryDto } from './dto/approval-queue-query.dto';
import { PaginatedApprovalQueueResponseDto } from './dto/approval-queue-response.dto';

@Controller('team')
export class TeamController {
  constructor(
    private readonly teamService: TeamService,
    private readonly leaveService: LeaveService,
  ) {}

  // ───────────────────────── Workload ─────────────────────────

  @Get('workload')
  async getWorkload(): Promise<WorkloadResponseDto> {
    return this.teamService.getWorkload();
  }

  // ───────────────────────── Approval Queue ─────────────────────────

  @Get('approval-queue')
  async getApprovalQueue(
    @CurrentUser() user: JwtPayload,
    @Query() query: ApprovalQueueQueryDto,
  ): Promise<PaginatedApprovalQueueResponseDto> {
    return this.teamService.getApprovalQueue(user.sub, user.role, query);
  }

  // ─────���─────────────────── Leave Management ─────────────────────────

  @Post('leave')
  async createLeave(@Body() dto: CreateLeaveDto): Promise<LeaveDto> {
    return this.leaveService.createLeave(dto);
  }

  @Get('leave')
  async listLeave(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListLeaveQueryDto,
  ): Promise<PaginatedLeaveResponseDto> {
    return this.leaveService.listLeave(query, user.role);
  }

  @Patch('leave/:id/approve')
  @Roles(UserRole.PARTNER, UserRole.MANAGER)
  async approveLeave(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LeaveDto> {
    return this.leaveService.approveLeave(id);
  }

  @Patch('leave/:id/reject')
  @Roles(UserRole.PARTNER, UserRole.MANAGER)
  async rejectLeave(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ): Promise<LeaveDto> {
    return this.leaveService.rejectLeave(id, body.reason);
  }

  @Patch('leave/:id/cancel')
  async cancelLeave(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LeaveDto> {
    return this.leaveService.cancelLeave(id);
  }
}
