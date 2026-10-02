import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { TrimmedString } from '../../common/validators/trim.transform';

export class CreateChecklistItemDto {
  @TrimmedString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  label!: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean = true;
}
