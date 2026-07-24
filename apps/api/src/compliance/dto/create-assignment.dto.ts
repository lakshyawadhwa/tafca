import {
  IsUUID,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID()
  clientId!: string;

  @IsUUID()
  statutoryDeadlineId!: string;

  @IsOptional()
  @IsBoolean()
  autoGenerateTasks?: boolean = true;

  /** null -> use firm default buffer. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  internalBufferDays?: number | null;

  /** null -> use the statutory day. Overrides the due day only. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  customDueDateDay?: number | null;

  /** Allow assigning a deadline not normally applicable to the entity type. */
  @IsOptional()
  @IsBoolean()
  force?: boolean = false;
}
