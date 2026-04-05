import { IsOptional, IsString, IsIn } from 'class-validator';

export class ListRecentlyDeletedQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['Client', 'Engagement', 'Task'])
  entityType?: string;
}
