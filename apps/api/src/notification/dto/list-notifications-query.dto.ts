import { IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ListNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  // enableImplicitConversion runs Boolean(value) first, which makes "false" true.
  // Read the raw query value off `obj` so "false" stays false.
  @Transform(({ obj, key }) => obj[key] === 'true')
  @IsBoolean()
  unreadOnly?: boolean;
}
