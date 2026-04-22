import {
  IsString,
  IsOptional,
  MaxLength,
  IsEmail,
  Matches,
} from 'class-validator';

export class UpdateFirmProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  icaiRegistration?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'PAN must be 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)',
  })
  pan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
