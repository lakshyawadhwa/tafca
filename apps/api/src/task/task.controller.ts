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
import { TaskChecklistService } from './task-checklist.service';
import { TaskDependencyService } from './task-dependency.service';
import { TaskCommentService } from './task-comment.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { CreateDependencyDto } from './dto/create-dependency.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import {
  TaskResponseDto,
  TaskListResponseDto,
  ActivityListResponseDto,
} from './dto/task-response.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@Controller('tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly activityService: TaskActivityService,
    private readonly checklistService: TaskChecklistService,
    private readonly dependencyService: TaskDependencyService,
    private readonly commentService: TaskCommentService,
  ) {}

  // ───────────────────────── Task CRUD ─────────────────────────

  @Post()
  @RequirePermission('task', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createTask(
    @Body() dto: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.taskService.createTask(dto);
  }

  @Get()
  @RequirePermission('task', 'view')
  async listTasks(
    @Query() query: ListTasksQueryDto,
  ): Promise<TaskListResponseDto> {
    return this.taskService.listTasks(query);
  }

  @Get(':id')
  @RequirePermission('task', 'view')
  async getTask(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TaskResponseDto> {
    return this.taskService.getTask(id);
  }

  @Patch(':id')
  @RequirePermission('task', 'edit')
  async updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.taskService.updateTask(id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('task', 'status_change')
  async changeTaskStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeTaskStatusDto,
  ): Promise<TaskResponseDto> {
    return this.taskService.changeTaskStatus(id, dto);
  }

  @Delete(':id')
  @RequirePermission('task', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTask(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.taskService.deleteTask(id);
  }

  @Get(':id/activity')
  @RequirePermission('task', 'view')
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

  // ───────────────────────── Checklist Sub-resource ─────────────────────────

  @Post(':taskId/checklist')
  @RequirePermission('checklist', 'create')
  @HttpCode(HttpStatus.CREATED)
  async addChecklistItem(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateChecklistItemDto,
  ) {
    return this.checklistService.addItem(taskId, dto);
  }

  @Get(':taskId/checklist')
  @RequirePermission('checklist', 'view')
  async listChecklistItems(
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.checklistService.listItems(taskId);
  }

  @Patch(':taskId/checklist/:id')
  @RequirePermission('checklist', 'edit')
  async updateChecklistItem(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.checklistService.updateItem(taskId, id, dto);
  }

  @Delete(':taskId/checklist/:id')
  @RequirePermission('checklist', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteChecklistItem(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.checklistService.deleteItem(taskId, id);
  }

  // ───────────────────────── Dependency Sub-resource ─────────────────────────

  @Post(':taskId/dependencies')
  @RequirePermission('dependency', 'create')
  @HttpCode(HttpStatus.CREATED)
  async addDependency(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateDependencyDto,
  ) {
    return this.dependencyService.addDependency(taskId, dto);
  }

  @Get(':taskId/dependencies')
  @RequirePermission('dependency', 'view')
  async getDependencies(
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.dependencyService.getDependencies(taskId);
  }

  @Delete(':taskId/dependencies/:dependsOnTaskId')
  @RequirePermission('dependency', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDependency(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('dependsOnTaskId', ParseUUIDPipe) dependsOnTaskId: string,
  ): Promise<void> {
    return this.dependencyService.removeDependency(taskId, dependsOnTaskId);
  }

  // ───────────────────────── Comment Sub-resource ─────────────────────────

  @Post(':taskId/comments')
  @RequirePermission('comment', 'create')
  @HttpCode(HttpStatus.CREATED)
  async addComment(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.addComment(taskId, dto);
  }

  @Get(':taskId/comments')
  async listComments(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.commentService.listComments(
      taskId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch(':taskId/comments/:id')
  @RequirePermission('comment', 'edit')
  async updateComment(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentService.updateComment(taskId, id, dto);
  }

  @Delete(':taskId/comments/:id')
  @RequirePermission('comment', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.commentService.deleteComment(taskId, id);
  }
}
