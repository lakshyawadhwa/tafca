import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EngagementService } from './engagement.service';
import { CreateEngagementDto } from './dto/create-engagement.dto';
import { UpdateEngagementDto } from './dto/update-engagement.dto';
import { ListEngagementsQueryDto } from './dto/list-engagements-query.dto';
import { ChangeEngagementStatusDto } from './dto/change-engagement-status.dto';
import {
  EngagementResponseDto,
  PaginatedEngagementsResponseDto,
} from './dto/engagement-response.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@Controller('engagements')
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  @Get()
  @RequirePermission('engagement', 'view')
  async listEngagements(
    @Query() query: ListEngagementsQueryDto,
  ): Promise<PaginatedEngagementsResponseDto> {
    return this.engagementService.listEngagements(query);
  }

  @Post()
  @RequirePermission('engagement', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createEngagement(
    @Body() dto: CreateEngagementDto,
  ): Promise<EngagementResponseDto> {
    return this.engagementService.createEngagement(dto);
  }

  @Get(':id')
  @RequirePermission('engagement', 'view')
  async getEngagement(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EngagementResponseDto> {
    return this.engagementService.getEngagement(id);
  }

  @Patch(':id')
  @RequirePermission('engagement', 'edit')
  async updateEngagement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEngagementDto,
  ): Promise<EngagementResponseDto> {
    return this.engagementService.updateEngagement(id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('engagement', 'status_change')
  async changeEngagementStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeEngagementStatusDto,
  ): Promise<EngagementResponseDto> {
    return this.engagementService.changeEngagementStatus(id, dto);
  }
}
