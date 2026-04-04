import {
  IsString,
  MaxLength,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  Length,
  Matches,
} from 'class-validator';
import { GstRegistrationType, REGEX } from '@ca-practice-os/shared';

export class CreateGstNumberDto {
  @IsString()
  @Matches(REGEX.GSTIN, {
    message:
      'Invalid GSTIN format. Expected: 15 characters (e.g., 27AAPFU0939F1ZV)',
  })
  gstin!: string;

  @IsString()
  @Length(2, 2)
  stateCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeName?: string;

  @IsEnum(GstRegistrationType)
  registrationType!: GstRegistrationType;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsDateString()
  registeredAt?: string;

  @IsOptional()
  @IsDateString()
  cancelledAt?: string;
}
