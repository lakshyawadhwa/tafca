import {
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
  IsEmail,
  IsArray,
  ArrayMaxSize,
  IsUUID,
  IsObject,
  Matches,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import {
  EntityType,
  ConstitutionType,
  ClientStatus,
  REGEX,
  LIMITS,
} from '@ca-practice-os/shared';

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @IsOptional()
  @IsEnum(ConstitutionType)
  constitution?: ConstitutionType;

  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @IsOptional()
  @IsString()
  @Matches(REGEX.PAN, {
    message: 'PAN must be 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)',
  })
  pan?: string;

  @IsOptional()
  @IsString()
  @Matches(REGEX.TAN, {
    message: 'TAN must be 4 letters + 5 digits + 1 letter (e.g., ABCD12345E)',
  })
  tan?: string;

  @IsOptional()
  @IsString()
  @Matches(REGEX.CIN, {
    message:
      'CIN must be 21 characters (e.g., U12345AB1234ABC123456)',
  })
  cin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  primaryContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  primaryContactPhone?: string;

  @IsOptional()
  @IsEmail()
  primaryContactEmail?: string;

  @IsOptional()
  @IsObject()
  address?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIMITS.MAX_TAGS_PER_ENTITY)
  @IsString({ each: true })
  @MaxLength(LIMITS.MAX_TAG_LENGTH, { each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  financialYearEnd?: number;

  @IsOptional()
  @IsUUID()
  assignedPartnerId?: string;

  @IsOptional()
  @IsUUID()
  assignedManagerId?: string;

  @IsOptional()
  @IsUUID()
  assignedJuniorId?: string;

  @IsOptional()
  @IsUUID()
  assignedArticleId?: string;
}
