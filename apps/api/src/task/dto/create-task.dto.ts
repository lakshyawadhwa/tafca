import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsArray,
  IsBoolean,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskPriority, LIMITS } from '@ca-practice-os/shared';

export class InitialChecklistItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  label!: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean = true;
}

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(LIMITS.TASK_TITLE_MAX_LENGTH)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.TASK_DESCRIPTION_MAX_LENGTH)
  description?: string;

  @IsOptional()
  @IsUUID()
  engagementId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  reviewerId?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority = TaskPriority.MEDIUM;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  internalDueDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(LIMITS.MAX_TAG_LENGTH, { each: true })
  @ArrayMaxSize(LIMITS.MAX_TAGS_PER_ENTITY)
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialChecklistItemDto)
  @ArrayMaxSize(LIMITS.MAX_CHECKLIST_ITEMS_PER_TASK)
  initialChecklistItems?: InitialChecklistItemDto[];
}
