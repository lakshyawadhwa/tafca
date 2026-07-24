import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { BulkAssignDto } from './dto/bulk-assign.dto';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { UpdateEntryStatusDto } from './dto/update-entry-status.dto';

@Controller('compliance')
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  @Get('deadlines')
  listDeadlines(
    @Query('category') category?: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.service.listDeadlines(category, entityType);
  }

  @Get('suggestions')
  getSuggestions(@Query('clientId', ParseUUIDPipe) clientId: string) {
    return this.service.getSuggestions(clientId);
  }

  @Get('assignments')
  listAssignments(@Query('clientId') clientId?: string) {
    return this.service.listAssignments(clientId);
  }

  @Post('assignments')
  createAssignment(@Body() dto: CreateAssignmentDto) {
    return this.service.createAssignment(dto);
  }

  @Post('assignments/bulk')
  bulkAssign(@Body() dto: BulkAssignDto) {
    return this.service.bulkAssign(
      dto.clientIds,
      dto.statutoryDeadlineIds,
      dto.autoGenerateTasks,
    );
  }

  @Patch('assignments/:id')
  updateAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.service.updateAssignment(id, dto);
  }

  @Delete('assignments/:id')
  @HttpCode(204)
  async deleteAssignment(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.deleteAssignment(id);
  }

  @Get('calendar')
  getCalendar(@Query() query: CalendarQueryDto) {
    return this.service.getCalendar(query);
  }

  @Patch('calendar/status')
  updateEntryStatus(@Body() dto: UpdateEntryStatusDto) {
    return this.service.updateEntryStatus(dto);
  }
}
