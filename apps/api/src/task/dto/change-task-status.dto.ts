import { IsEnum, IsNotEmpty } from 'class-validator';
import { TaskStatus } from '@ca-practice-os/shared';

export class ChangeTaskStatusDto {
  @IsEnum(TaskStatus)
  @IsNotEmpty()
  status!: TaskStatus;
}
