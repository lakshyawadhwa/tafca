import { IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class UpdateAssignmentDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoGenerateTasks?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  internalBufferDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  customDueDateDay?: number | null;
}
