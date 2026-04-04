import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskActivityService } from './task-activity.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import {
  TaskResponseDto,
  TaskListResponseDto,
  ActivityListResponseDto,
} from './dto/task-response.dto';

@Controller('tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly activityService: TaskActivityService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTask(
    @Body() dto: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.taskService.createTask(dto);
  }

  @Get()
  async listTasks(
    @Query() query: ListTasksQueryDto,
  ): Promise<TaskListResponseDto> {
    return this.taskService.listTasks(query);
  }

  @Get(':id')
  async getTask(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TaskResponseDto> {
    return this.taskService.getTask(id);
  }

  @Patch(':id')
  async updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.taskService.updateTask(id, dto);
  }

  @Patch(':id/status')
  async changeTaskStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeTaskStatusDto,
  ): Promise<TaskResponseDto> {
    return this.taskService.changeTaskStatus(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTask(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.taskService.deleteTask(id);
  }

  @Get(':id/activity')
  async getActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ActivityListResponseDto> {
    return this.activityService.getActivity(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
