import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsIn,
  IsDateString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListTasksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'updatedAt', 'dueDate', 'priority', 'title'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  engagementId?: string;

  /** Comma-separated TaskStatus values, e.g. "TO_DO,IN_PROGRESS" */
  @IsOptional()
  @IsString()
  status?: string;

  /** Comma-separated TaskPriority values, e.g. "HIGH,URGENT" */
  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  /** If true, filter overdue tasks (dueDate < today AND status not DONE/CANCELLED) */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  overdue?: boolean;

  /** Filter subtasks of a specific parent. When absent, only top-level tasks returned. */
  @IsOptional()
  @IsUUID()
  parentTaskId?: string;
}
