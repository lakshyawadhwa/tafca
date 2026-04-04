import { IsEnum } from 'class-validator';
import { EngagementStatus } from '@ca-practice-os/shared';

export class ChangeEngagementStatusDto {
  @IsEnum(EngagementStatus)
  status!: EngagementStatus;
}
