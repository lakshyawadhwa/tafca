import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { TrimmedString } from '../../common/validators/trim.transform';

export class UpdateChecklistItemDto {
  @IsOptional()
  @TrimmedString()
  @IsString()
  @MaxLength(300)
  label?: string;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
