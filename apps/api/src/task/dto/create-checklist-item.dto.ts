import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateChecklistItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  label!: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean = true;
}
