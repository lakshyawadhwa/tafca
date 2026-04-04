import {
  IsUUID,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEngagementDto {
  @IsUUID()
  clientId!: string;

  @IsUUID()
  engagementTypeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  periodLabel?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsOptional()
  @IsUUID()
  assignedPartnerId?: string;

  @IsOptional()
  @IsUUID()
  assignedManagerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feeAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  autoCreateTasks?: boolean;
}
