import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsArray,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { TaskPriority, LIMITS } from '@ca-practice-os/shared';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.TASK_TITLE_MAX_LENGTH)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.TASK_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @IsOptional()
  @IsUUID()
  clientId?: string | null;

  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @IsUUID()
  reviewerId?: string | null;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsDateString()
  internalDueDate?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(LIMITS.MAX_TAG_LENGTH, { each: true })
  @ArrayMaxSize(LIMITS.MAX_TAGS_PER_ENTITY)
  tags?: string[];
}
