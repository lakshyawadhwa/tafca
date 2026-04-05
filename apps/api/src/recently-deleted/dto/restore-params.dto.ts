import { IsString, IsIn, IsUUID } from 'class-validator';

export class RestoreParamsDto {
  @IsString()
  @IsIn(['Client', 'Engagement', 'Task'])
  entityType!: string;

  @IsUUID()
  entityId!: string;
}
