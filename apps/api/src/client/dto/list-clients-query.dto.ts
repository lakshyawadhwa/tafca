import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ClientStatus, EntityType } from '@ca-practice-os/shared';

export class ListClientsQueryDto {
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
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsUUID()
  assignedPartnerId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['displayName', 'createdAt', 'updatedAt', 'status'])
  sortBy?: string = 'displayName';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}
