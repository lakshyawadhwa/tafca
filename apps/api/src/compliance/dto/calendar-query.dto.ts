import {
  IsOptional,
  IsUUID,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import {
  EngagementCategory,
  ComplianceEntryStatus,
} from '@ca-practice-os/shared';

export class CalendarQueryDto {
  /** Inclusive window start (YYYY-MM-DD). Default: today - 30d. */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Inclusive window end (YYYY-MM-DD). Default: today + 60d. */
  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsEnum(EngagementCategory)
  category?: EngagementCategory;

  @IsOptional()
  @IsEnum(ComplianceEntryStatus)
  status?: ComplianceEntryStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 100;
}
