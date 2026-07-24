import {
  IsArray,
  IsUUID,
  ArrayMaxSize,
  ArrayNotEmpty,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class BulkAssignDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  clientIds!: string[];

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  statutoryDeadlineIds!: string[];

  @IsOptional()
  @IsBoolean()
  autoGenerateTasks?: boolean = true;
}
