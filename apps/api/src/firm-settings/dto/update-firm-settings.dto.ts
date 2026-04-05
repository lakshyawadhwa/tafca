import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
  IsString,
} from 'class-validator';

export class UpdateFirmSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  default_internal_deadline_buffer_days?: number;

  @IsOptional()
  @IsBoolean()
  auto_task_generation_enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  require_partner_approval_for?: string[];
}
