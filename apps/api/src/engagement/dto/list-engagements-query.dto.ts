import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  IsUUID,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EngagementStatus } from '@ca-practice-os/shared';

export class ListEngagementsQueryDto {
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
  search?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  engagementTypeId?: string;

  @IsOptional()
  @IsEnum(EngagementStatus)
  status?: EngagementStatus;

  @IsOptional()
  @IsString()
  @IsIn(['name', 'createdAt', 'updatedAt', 'status', 'periodStart'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
