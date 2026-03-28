import {
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
  IsObject,
  Matches,
} from 'class-validator';
import { UserRole } from '@ca-practice-os/shared';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'phone must be in E.164 format' })
  phone?: string | null;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsObject()
  notificationPreferences?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string | null;
}
