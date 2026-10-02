import {
  IsEnum,
  IsDateString,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { LeaveType } from '@ca-practice-os/shared';
import { IsNotBeforeField } from '../../common/validators/is-after-date.validator';

export class CreateLeaveDto {
  @IsEnum(LeaveType)
  leaveType!: LeaveType;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  @IsNotBeforeField('startDate')
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  isHalfDay?: boolean = false;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
